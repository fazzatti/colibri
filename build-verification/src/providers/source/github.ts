import { detectArchiveFormat } from "../../archive/detect.ts";
import { sha256Hex } from "../../core/comparison/compare-wasm.ts";
import type { ResolvedVerificationSource } from "../../core/types/index.ts";
import type {
  GitHubSourceCredentials,
  HttpVerificationSourceProviderOptions,
  SourceAddressResolver,
  SourceHttpTransport,
  VerificationSourceProvider,
  VerificationSourceProviderInput,
} from "./types.ts";
import {
  DenoSourceAddressResolver,
  PinnedAddressHttpTransport,
  retrievePinnedHttpResource,
} from "./http.ts";
import {
  GitHubReleaseAssetResolutionFailedError,
  GitHubRevisionResolutionFailedError,
  UnsupportedSourceError,
} from "./error.ts";
import { BuildVerificationError } from "../../error/base.ts";

/** Options used by the GitHub revision and release-asset provider. */
export type GitHubVerificationSourceProviderOptions =
  & Pick<HttpVerificationSourceProviderOptions, "policy">
  & GitHubSourceCredentials
  & {
    readonly transport?: SourceHttpTransport;
    readonly addressResolver?: SourceAddressResolver;
  };

const validateRepository = (owner: string, repository: string): string => {
  for (const [field, value] of Object.entries({ owner, repository })) {
    if (!value || value.includes("/") || value.includes("..")) {
      throw new UnsupportedSourceError(
        "GitHub owner and repository must be non-empty path components.",
        { field, value },
      );
    }
  }
  return `${owner}/${repository}`;
};

const decodeJson = <Value>(bytes: Uint8Array): Value =>
  JSON.parse(new TextDecoder().decode(bytes)) as Value;

/** Provider for immutable GitHub revision archives and release assets. */
export class GitHubVerificationSourceProvider
  implements VerificationSourceProvider {
  readonly #policy: HttpVerificationSourceProviderOptions["policy"];
  readonly #transport: SourceHttpTransport;
  readonly #addressResolver: SourceAddressResolver;
  readonly #apiHeaders: Readonly<Record<string, string>>;
  readonly #downloadHeaders: Readonly<Record<string, string>>;

  /** Creates a GitHub provider whose token remains host-side and redacted. */
  constructor(options: GitHubVerificationSourceProviderOptions) {
    this.#policy = options.policy;
    this.#transport = options.transport ?? new PinnedAddressHttpTransport();
    this.#addressResolver = options.addressResolver ??
      new DenoSourceAddressResolver();
    this.#apiHeaders = {
      accept: "application/vnd.github+json",
      "user-agent": "colibri-build-verification",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    };
    this.#downloadHeaders = {
      "user-agent": "colibri-build-verification",
    };
  }

  /** Keeps the GitHub token on API requests and drops it before redirects. */
  #headersForUrl(url: URL): Readonly<Record<string, string>> {
    return url.hostname.toLowerCase() === "api.github.com"
      ? this.#apiHeaders
      : this.#downloadHeaders;
  }

  /** Resolves a revision to a commit SHA or selects one exact release asset. */
  async resolve(
    input: VerificationSourceProviderInput,
  ): Promise<ResolvedVerificationSource> {
    if (
      input.source.type !== "githubArchive" &&
      input.source.type !== "githubReleaseAsset"
    ) {
      throw new TypeError("GitHub provider requires a GitHub source");
    }
    const repository = validateRepository(
      input.source.owner,
      input.source.repository,
    );
    if (input.source.type === "githubArchive") {
      if (!input.source.revision) {
        throw new UnsupportedSourceError("GitHub revision cannot be empty.");
      }
      let resolvedRevision: string;
      try {
        const api = await retrievePinnedHttpResource({
          url: `https://api.github.com/repos/${repository}/commits/${
            encodeURIComponent(input.source.revision)
          }`,
          limits: input.limits,
          policy: this.#policy,
          transport: this.#transport,
          addressResolver: this.#addressResolver,
          headers: (url) => this.#headersForUrl(url),
          maxBytes: Math.min(input.limits.maxArchiveBytes, 2 * 1024 * 1024),
        });
        resolvedRevision = decodeJson<{ sha?: string }>(api.bytes).sha ?? "";
        if (!/^[0-9a-f]{40}$/.test(resolvedRevision)) {
          throw new Error("GitHub response omitted an exact commit SHA");
        }
      } catch (cause) {
        if (cause instanceof BuildVerificationError) throw cause;
        throw new GitHubRevisionResolutionFailedError(
          repository,
          input.source.revision,
          cause,
        );
      }
      const zip = input.source.format === "zip";
      const extension = zip ? "zip" : "tar.gz";
      const archive = await retrievePinnedHttpResource({
        url: `https://api.github.com/repos/${repository}/${
          zip ? "zipball" : "tarball"
        }/${resolvedRevision}`,
        limits: input.limits,
        policy: this.#policy,
        transport: this.#transport,
        addressResolver: this.#addressResolver,
        headers: (url) => this.#headersForUrl(url),
      });
      return {
        content: "archive" as const,
        kind: "githubArchive" as const,
        bytes: archive.bytes,
        name: `${resolvedRevision}.${extension}`,
        format: detectArchiveFormat(`${resolvedRevision}.${extension}`),
        requestedLocator: `https://github.com/${repository}/tree/${
          encodeURIComponent(input.source.revision)
        }`,
        resolvedLocator: archive.finalUrl,
        requestedRevision: input.source.revision,
        resolvedRevision,
        contentType: archive.headers["content-type"],
        retrievalPolicy: archive.policy,
        size: archive.bytes.length,
        sha256: await sha256Hex(archive.bytes),
      };
    }

    const releaseSource = input.source;
    if (
      !releaseSource.tag || !releaseSource.asset ||
      releaseSource.asset.includes("/")
    ) {
      throw new UnsupportedSourceError(
        "GitHub release tags and exact asset names must be non-empty and portable.",
      );
    }
    let assetUrl: string;
    try {
      const api = await retrievePinnedHttpResource({
        url: `https://api.github.com/repos/${repository}/releases/tags/${
          encodeURIComponent(releaseSource.tag)
        }`,
        limits: input.limits,
        policy: this.#policy,
        transport: this.#transport,
        addressResolver: this.#addressResolver,
        headers: (url) => this.#headersForUrl(url),
        maxBytes: Math.min(input.limits.maxArchiveBytes, 4 * 1024 * 1024),
      });
      const release = decodeJson<{
        assets?: Array<{ name?: string; url?: string }>;
      }>(api.bytes);
      const asset = release.assets?.find(({ name }) =>
        name === releaseSource.asset
      );
      assetUrl = asset?.url ?? "";
      if (!assetUrl) throw new Error("GitHub release omitted the named asset");
    } catch (cause) {
      if (cause instanceof BuildVerificationError) throw cause;
      throw new GitHubReleaseAssetResolutionFailedError(
        repository,
        releaseSource.tag,
        releaseSource.asset,
        cause,
      );
    }
    const archive = await retrievePinnedHttpResource({
      url: assetUrl,
      limits: input.limits,
      policy: this.#policy,
      transport: this.#transport,
      addressResolver: this.#addressResolver,
      headers: (url) => ({
        ...this.#headersForUrl(url),
        ...(url.hostname.toLowerCase() === "api.github.com"
          ? { accept: "application/octet-stream" }
          : {}),
      }),
    });
    return {
      content: "archive" as const,
      kind: "githubReleaseAsset" as const,
      bytes: archive.bytes,
      name: releaseSource.asset,
      format: detectArchiveFormat(releaseSource.asset),
      requestedLocator: `https://github.com/${repository}/releases/tag/${
        encodeURIComponent(releaseSource.tag)
      }`,
      resolvedLocator: archive.finalUrl,
      contentType: archive.headers["content-type"],
      retrievalPolicy: archive.policy,
      size: archive.bytes.length,
      sha256: await sha256Hex(archive.bytes),
    };
  }
}
