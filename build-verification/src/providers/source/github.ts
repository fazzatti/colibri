import { detectArchiveFormat } from "@/archive/detect.ts";
import { sha256Hex } from "@/core/comparison/compare-wasm.ts";
import type {
  ResolvedVerificationSource,
  VerificationSource,
} from "@/core/types/index.ts";
import type {
  GitHubSourceCredentials,
  HttpVerificationSourceProviderOptions,
  SourceAddressResolver,
  SourceHttpTransport,
  VerificationSourceProvider,
  VerificationSourceProviderInput,
} from "@/providers/source/types.ts";
import {
  DenoSourceAddressResolver,
  PinnedAddressHttpTransport,
  retrievePinnedHttpResource,
} from "@/providers/source/http.ts";
import {
  GitHubCommitShaMissingError,
  GitHubReleaseAssetMissingError,
  GitHubReleaseAssetResolutionFailedError,
  GitHubRevisionResolutionFailedError,
  GitHubSourceProviderInputMismatchError,
  UnsupportedSourceError,
} from "@/providers/source/error.ts";

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

/** Decode the upstream response before using its immutable revision. @internal */
export function decodeGitHubRevision(
  bytes: Uint8Array,
  repository: string,
  revision: string,
): string {
  let resolved: string;
  try {
    resolved = decodeJson<{ sha?: string }>(bytes).sha ?? "";
  } catch (cause) {
    throw new GitHubRevisionResolutionFailedError(repository, revision, cause);
  }
  if (!/^[0-9a-f]{40}$/.test(resolved)) {
    throw new GitHubCommitShaMissingError(repository, revision);
  }
  return resolved;
}

/** Decode one exact release asset, independently of HTTP transport. @internal */
export function decodeGitHubReleaseAsset(
  bytes: Uint8Array,
  repository: string,
  tag: string,
  assetName: string,
): string {
  let asset: { name?: string; url?: string } | undefined;
  try {
    const release = decodeJson<
      { assets?: Array<{ name?: string; url?: string }> }
    >(bytes);
    asset = release.assets?.find(({ name }) => name === assetName);
  } catch (cause) {
    throw new GitHubReleaseAssetResolutionFailedError(
      repository,
      tag,
      assetName,
      cause,
    );
  }
  if (!asset?.url) {
    throw new GitHubReleaseAssetMissingError(repository, tag, assetName);
  }
  return asset.url;
}

type GitHubArchiveSource = Extract<
  VerificationSource,
  { type: "githubArchive" }
>;
type GitHubReleaseSource = Extract<
  VerificationSource,
  { type: "githubReleaseAsset" }
>;

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

  async #resolveRevision(
    repository: string,
    revision: string,
    limits: VerificationSourceProviderInput["limits"],
  ): Promise<string> {
    const api = await retrievePinnedHttpResource({
      url: `https://api.github.com/repos/${repository}/commits/${
        encodeURIComponent(revision)
      }`,
      limits,
      policy: this.#policy,
      transport: this.#transport,
      addressResolver: this.#addressResolver,
      headers: (url) => this.#headersForUrl(url),
      maxBytes: Math.min(limits.maxArchiveBytes, 2 * 1024 * 1024),
    });
    return decodeGitHubRevision(api.bytes, repository, revision);
  }

  async #resolveArchive(
    source: GitHubArchiveSource,
    limits: VerificationSourceProviderInput["limits"],
    repository: string,
  ): Promise<ResolvedVerificationSource> {
    if (!source.revision) {
      throw new UnsupportedSourceError("GitHub revision cannot be empty.");
    }
    const resolvedRevision = await this.#resolveRevision(
      repository,
      source.revision,
      limits,
    );
    const zip = source.format === "zip";
    const extension = zip ? "zip" : "tar.gz";
    const archive = await retrievePinnedHttpResource({
      url: `https://api.github.com/repos/${repository}/${
        zip ? "zipball" : "tarball"
      }/${resolvedRevision}`,
      limits,
      policy: this.#policy,
      transport: this.#transport,
      addressResolver: this.#addressResolver,
      headers: (url) => this.#headersForUrl(url),
    });
    return {
      content: "archive",
      kind: "githubArchive",
      bytes: archive.bytes,
      name: `${resolvedRevision}.${extension}`,
      format: detectArchiveFormat(`${resolvedRevision}.${extension}`),
      requestedLocator: `https://github.com/${repository}/tree/${
        encodeURIComponent(source.revision)
      }`,
      resolvedLocator: archive.finalUrl,
      requestedRevision: source.revision,
      resolvedRevision,
      contentType: archive.headers["content-type"],
      retrievalPolicy: archive.policy,
      size: archive.bytes.length,
      sha256: await sha256Hex(archive.bytes),
    };
  }

  async #resolveReleaseAssetUrl(
    source: GitHubReleaseSource,
    limits: VerificationSourceProviderInput["limits"],
    repository: string,
  ): Promise<string> {
    const api = await retrievePinnedHttpResource({
      url: `https://api.github.com/repos/${repository}/releases/tags/${
        encodeURIComponent(source.tag)
      }`,
      limits,
      policy: this.#policy,
      transport: this.#transport,
      addressResolver: this.#addressResolver,
      headers: (url) => this.#headersForUrl(url),
      maxBytes: Math.min(limits.maxArchiveBytes, 4 * 1024 * 1024),
    });
    return decodeGitHubReleaseAsset(
      api.bytes,
      repository,
      source.tag,
      source.asset,
    );
  }

  async #resolveRelease(
    source: GitHubReleaseSource,
    limits: VerificationSourceProviderInput["limits"],
    repository: string,
  ): Promise<ResolvedVerificationSource> {
    if (!source.tag || !source.asset || source.asset.includes("/")) {
      throw new UnsupportedSourceError(
        "GitHub release tags and exact asset names must be non-empty and portable.",
      );
    }
    const assetUrl = await this.#resolveReleaseAssetUrl(
      source,
      limits,
      repository,
    );
    const archive = await retrievePinnedHttpResource({
      url: assetUrl,
      limits,
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
      content: "archive",
      kind: "githubReleaseAsset",
      bytes: archive.bytes,
      name: source.asset,
      format: detectArchiveFormat(source.asset),
      requestedLocator: `https://github.com/${repository}/releases/tag/${
        encodeURIComponent(source.tag)
      }`,
      resolvedLocator: archive.finalUrl,
      contentType: archive.headers["content-type"],
      retrievalPolicy: archive.policy,
      size: archive.bytes.length,
      sha256: await sha256Hex(archive.bytes),
    };
  }

  /** Resolves a revision to a commit SHA or selects one exact release asset. */
  async resolve(
    input: VerificationSourceProviderInput,
  ): Promise<ResolvedVerificationSource> {
    if (
      input.source.type !== "githubArchive" &&
      input.source.type !== "githubReleaseAsset"
    ) {
      throw new GitHubSourceProviderInputMismatchError(input.source.type);
    }
    const repository = validateRepository(
      input.source.owner,
      input.source.repository,
    );
    if (input.source.type === "githubArchive") {
      return await this.#resolveArchive(input.source, input.limits, repository);
    }
    return await this.#resolveRelease(input.source, input.limits, repository);
  }
}
