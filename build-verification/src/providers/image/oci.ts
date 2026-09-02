import { sha256Hex } from "@/core/comparison/compare-wasm.ts";
import type {
  ContainerImageDetails,
  ContainerImageProvenance,
  ContainerImageReferrer,
  ContainerImageSbom,
} from "@/core/policy/types.ts";
import { DefaultSourceRetrievalPolicy } from "@/core/policy/source-retrieval.ts";
import { DEFAULT_BUILD_VERIFICATION_LIMITS } from "@/core/types/limits.ts";
import type {
  ContainerImageResolver,
  OciContainerImageResolverOptions,
} from "@/providers/image/types.ts";
import {
  ImageAttestationDecodingFailedError,
  ImageAuthenticationChallengeInvalidError,
  ImageConfigDigestMismatchError,
  ImageConfigResolutionFailedError,
  ImageManifestDigestMismatchError,
  ImageManifestResolutionFailedError,
  ImageReferrerDigestMismatchError,
  ImageReferrersResolutionFailedError,
  ImageRegistryRequestRejectedError,
  MultiArchImageError,
} from "@/providers/image/error.ts";
import { parseContainerImageReference } from "@/providers/image/reference.ts";
import {
  collectBoundedSourceResponse,
  DenoSourceAddressResolver,
  PinnedAddressHttpTransport,
  redactSourceUrl,
  retrievePinnedHttpResource,
} from "@/providers/source/http.ts";
import {
  SourcePolicyRejectedError,
  SourceRequestTimedOutError,
} from "@/providers/source/error.ts";
import type {
  SourceAddressResolver,
  SourceHttpResponse,
  SourceHttpTransport,
  SourceHttpTransportInput,
} from "@/providers/source/types.ts";

const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
].join(", ");
const INDEX_MEDIA_TYPES = new Set([
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
]);
const REGISTRY_FETCH_RETRY_DELAYS_MS = [0, 25, 100] as const;
const INJECTED_FETCH_ADDRESS_RESOLVER: SourceAddressResolver = {
  resolve: () => Promise.resolve(["93.184.216.34"]),
};

type OciDescriptor = {
  readonly mediaType?: string;
  readonly digest?: string;
  readonly size?: number;
  readonly artifactType?: string;
  readonly annotations?: Record<string, string>;
};

const registryOrigin = (registry: string): string => {
  if (registry === "docker.io") return "https://registry-1.docker.io";
  return `${registry.startsWith("localhost") ? "http" : "https"}://${registry}`;
};

const parseBearerChallenge = (
  reference: string,
  header: string | null,
): URL | null => {
  if (!header?.startsWith("Bearer ")) return null;
  const values = Object.fromEntries(
    [...header.slice(7).matchAll(/([a-z]+)="([^"]*)"/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  if (!values.realm) return null;
  let url: URL;
  try {
    url = new URL(values.realm);
  } catch (cause) {
    throw new ImageAuthenticationChallengeInvalidError(reference, cause);
  }
  if (values.service) url.searchParams.set("service", values.service);
  if (values.scope) url.searchParams.set("scope", values.scope);
  return url;
};

class FetchImageHttpTransport implements SourceHttpTransport {
  readonly #fetcher: typeof fetch;

  constructor(fetcher: typeof fetch) {
    this.#fetcher = fetcher;
  }

  async request(input: SourceHttpTransportInput): Promise<SourceHttpResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.timeoutMs);
    let response: Response;
    try {
      response = await this.#fetcher(input.url, {
        headers: input.headers,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (cause) {
      if (controller.signal.aborted) {
        throw new SourceRequestTimedOutError(input.url, input.timeoutMs);
      }
      throw cause;
    } finally {
      clearTimeout(timeout);
    }
    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      bytes: await collectBoundedSourceResponse(
        response.body ?? new ReadableStream<Uint8Array>({
          start: (controller) => controller.close(),
        }),
        input.maxBytes,
      ),
    };
  }
}

class RegistryClient {
  readonly #reference: string;
  readonly #parsed: ReturnType<typeof parseContainerImageReference>;
  readonly #policy: NonNullable<
    OciContainerImageResolverOptions["retrievalPolicy"]
  >;
  readonly #transport: SourceHttpTransport;
  readonly #addressResolver: SourceAddressResolver;
  readonly #downloadTimeoutMs: number;
  readonly #maxRedirects: number;
  #token?: string;

  constructor(
    reference: string,
    parsed: ReturnType<typeof parseContainerImageReference>,
    options: {
      readonly policy: NonNullable<
        OciContainerImageResolverOptions["retrievalPolicy"]
      >;
      readonly transport: SourceHttpTransport;
      readonly addressResolver: SourceAddressResolver;
      readonly downloadTimeoutMs: number;
      readonly maxRedirects: number;
    },
  ) {
    this.#reference = reference;
    this.#parsed = parsed;
    this.#policy = options.policy;
    this.#transport = options.transport;
    this.#addressResolver = options.addressResolver;
    this.#downloadTimeoutMs = options.downloadTimeoutMs;
    this.#maxRedirects = options.maxRedirects;
  }

  async #fetch(
    input: string | URL,
    headers: Readonly<Record<string, string>>,
    maximum: number,
  ): Promise<Awaited<ReturnType<typeof retrievePinnedHttpResource>>> {
    let lastCause: unknown;
    for (const delayMs of REGISTRY_FETCH_RETRY_DELAYS_MS) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      try {
        return await retrievePinnedHttpResource({
          url: String(input),
          limits: {
            ...DEFAULT_BUILD_VERIFICATION_LIMITS,
            downloadTimeoutMs: this.#downloadTimeoutMs,
            maxRedirects: this.#maxRedirects,
          },
          policy: this.#policy,
          transport: this.#transport,
          addressResolver: this.#addressResolver,
          headers,
          maxBytes: maximum,
          acceptStatus: () => true,
        });
      } catch (cause) {
        if (cause instanceof SourcePolicyRejectedError) {
          throw new ImageRegistryRequestRejectedError(
            this.#reference,
            redactSourceUrl(String(input)),
            cause,
          );
        }
        lastCause = cause;
      }
    }
    throw lastCause;
  }

  async #fetchManifestResource(
    input: string | URL,
    headers: Readonly<Record<string, string>>,
    maximum: number,
  ): Promise<Awaited<ReturnType<typeof retrievePinnedHttpResource>>> {
    try {
      return await this.#fetch(input, headers, maximum);
    } catch (cause) {
      if (cause instanceof ImageRegistryRequestRejectedError) throw cause;
      throw new ImageManifestResolutionFailedError(this.#reference, cause);
    }
  }

  #storeToken(
    response: Awaited<ReturnType<typeof retrievePinnedHttpResource>>,
  ): void {
    try {
      const body = JSON.parse(new TextDecoder().decode(response.bytes)) as {
        token?: string;
        access_token?: string;
      };
      this.#token = body.token ?? body.access_token;
    } catch (cause) {
      throw new ImageManifestResolutionFailedError(
        this.#reference,
        cause,
        response.status,
      );
    }
    if (!this.#token) {
      throw new ImageManifestResolutionFailedError(
        this.#reference,
        undefined,
        response.status,
      );
    }
  }

  async #authenticate(
    response: Awaited<ReturnType<typeof retrievePinnedHttpResource>>,
    maximum: number,
  ): Promise<void> {
    const tokenUrl = parseBearerChallenge(
      this.#reference,
      response.headers["www-authenticate"] ?? null,
    );
    if (!tokenUrl) {
      throw new ImageAuthenticationChallengeInvalidError(this.#reference);
    }
    const tokenResponse = await this.#fetchManifestResource(
      tokenUrl,
      { accept: "application/json" },
      Math.min(maximum, 1024 * 1024),
    );
    if (tokenResponse.status < 200 || tokenResponse.status >= 300) {
      throw new ImageManifestResolutionFailedError(
        this.#reference,
        undefined,
        tokenResponse.status,
      );
    }
    this.#storeToken(tokenResponse);
  }

  async request(
    path: string,
    accept: string,
    maximum: number,
  ): Promise<Awaited<ReturnType<typeof retrievePinnedHttpResource>>> {
    const url = `${
      registryOrigin(this.#parsed.registry)
    }/v2/${this.#parsed.repository}/${path}`;
    const response = await this.#fetchManifestResource(
      url,
      {
        accept,
        ...(this.#token ? { authorization: `Bearer ${this.#token}` } : {}),
      },
      maximum,
    );
    if (response.status !== 401 || this.#token) return response;
    await this.#authenticate(response, maximum);
    return await this.#fetchManifestResource(
      url,
      { accept, authorization: `Bearer ${this.#token}` },
      maximum,
    );
  }
}

const fetchDescriptorBytes = async (
  client: RegistryClient,
  reference: string,
  descriptor: OciDescriptor,
  maximum: number,
  owner: "config" | "referrer",
): Promise<Uint8Array> => {
  if (!descriptor.digest || !/^sha256:[0-9a-f]{64}$/.test(descriptor.digest)) {
    const cause = new TypeError(
      `OCI ${owner} descriptor omitted a sha256 digest`,
    );
    if (owner === "config") {
      throw new ImageConfigResolutionFailedError(reference, cause);
    }
    throw new ImageReferrersResolutionFailedError(reference, cause);
  }
  const response = await client.request(
    `blobs/${descriptor.digest}`,
    descriptor.mediaType ?? "application/octet-stream",
    maximum,
  );
  if (response.status < 200 || response.status >= 300) {
    if (owner === "config") {
      throw new ImageConfigResolutionFailedError(
        descriptor.digest,
        undefined,
        response.status,
      );
    }
    throw new ImageReferrersResolutionFailedError(
      descriptor.digest,
      undefined,
      response.status,
    );
  }
  const bytes = response.bytes;
  const actual = `sha256:${await sha256Hex(bytes)}`;
  if (actual !== descriptor.digest) {
    if (owner === "config") {
      throw new ImageConfigDigestMismatchError(descriptor.digest, actual);
    }
    throw new ImageReferrerDigestMismatchError(descriptor.digest, actual);
  }
  return bytes;
};

const collectGitHubSources = (value: unknown, output: Set<string>): void => {
  if (typeof value === "string") {
    if (value.toLowerCase().startsWith("https://github.com/")) {
      output.add(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectGitHubSources(item, output);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const item of Object.values(value)) collectGitHubSources(item, output);
  }
};

const parseAttestation = (
  digest: string,
  bytes: Uint8Array,
  predicateHint: string,
): {
  readonly kind: "provenance" | "sbom" | "other";
  readonly predicateType?: string;
  readonly subjects: readonly string[];
  readonly sources: readonly string[];
  readonly format?: string;
} => {
  let statement: Record<string, unknown>;
  try {
    statement = JSON.parse(new TextDecoder().decode(bytes));
  } catch (cause) {
    throw new ImageAttestationDecodingFailedError(digest, cause);
  }
  const predicateType = typeof statement.predicateType === "string"
    ? statement.predicateType
    : predicateHint;
  const lower = predicateType.toLowerCase();
  const subjects = Array.isArray(statement.subject)
    ? statement.subject.flatMap((subject) => {
      if (typeof subject !== "object" || subject === null) return [];
      const digest = (subject as { digest?: unknown }).digest;
      if (typeof digest !== "object" || digest === null) return [];
      const sha256 = (digest as { sha256?: unknown }).sha256;
      return typeof sha256 === "string" ? [sha256] : [];
    })
    : [];
  const sources = new Set<string>();
  collectGitHubSources(statement.predicate, sources);
  if (lower.includes("spdx") || lower.includes("cyclonedx")) {
    return {
      kind: "sbom",
      predicateType,
      subjects,
      sources: [...sources],
      format: lower.includes("spdx") ? "spdx" : "cyclonedx",
    };
  }
  if (lower.includes("provenance") || lower.includes("slsa")) {
    return {
      kind: "provenance",
      predicateType,
      subjects,
      sources: [...sources],
    };
  }
  return { kind: "other", predicateType, subjects, sources: [...sources] };
};

type ReferrerState = {
  referrers: ContainerImageReferrer[];
  predicateTypes: Set<string>;
  subjectDigests: Set<string>;
  sourceRepositories: Set<string>;
  sbomFormats: Set<string>;
  provenancePresent: boolean;
  provenanceParsed: boolean;
};

const emptyReferrerResult = (): {
  referrers: ContainerImageReferrer[];
  provenance: ContainerImageProvenance;
  sbom: ContainerImageSbom;
} => ({
  referrers: [],
  provenance: {
    present: false,
    parsed: false,
    signatureVerified: false,
    predicateTypes: [],
    subjectDigests: [],
    sourceRepositories: [],
  },
  sbom: { present: false, formats: [] },
});

const readReferrerDescriptors = (
  reference: string,
  response: Awaited<ReturnType<typeof retrievePinnedHttpResource>>,
  maxReferrers: number,
): OciDescriptor[] => {
  if (response.status < 200 || response.status >= 300) {
    throw new ImageReferrersResolutionFailedError(
      reference,
      undefined,
      response.status,
    );
  }
  let descriptors: OciDescriptor[];
  try {
    const index = JSON.parse(new TextDecoder().decode(response.bytes)) as {
      manifests?: OciDescriptor[];
    };
    descriptors = index.manifests ?? [];
  } catch (cause) {
    throw new ImageReferrersResolutionFailedError(
      reference,
      cause,
      response.status,
    );
  }
  if (descriptors.length > maxReferrers) {
    throw new ImageReferrersResolutionFailedError(
      reference,
      new RangeError("OCI referrer count exceeds its configured limit"),
    );
  }
  return descriptors;
};

const recordAttestation = (
  state: ReferrerState,
  parsed: ReturnType<typeof parseAttestation>,
): void => {
  if (parsed.kind === "provenance") {
    state.provenancePresent = true;
    state.provenanceParsed = true;
    if (parsed.predicateType) state.predicateTypes.add(parsed.predicateType);
    for (const subject of parsed.subjects) state.subjectDigests.add(subject);
    for (const source of parsed.sources) state.sourceRepositories.add(source);
  } else if (parsed.kind === "sbom" && parsed.format) {
    state.sbomFormats.add(parsed.format);
  }
};

const resolveAttestationLayer = async (
  client: RegistryClient,
  reference: string,
  descriptor: OciDescriptor,
  layer: OciDescriptor,
  maximum: number,
  state: ReferrerState,
): Promise<void> => {
  const predicateHint = layer.annotations?.["in-toto.io/predicate-type"] ??
    descriptor.annotations?.["in-toto.io/predicate-type"] ?? "";
  const isAttestation = layer.mediaType?.includes("in-toto") ||
    predicateHint.length > 0;
  if (!isAttestation) return;
  const bytes = await fetchDescriptorBytes(
    client,
    reference,
    layer,
    maximum,
    "referrer",
  );
  recordAttestation(
    state,
    parseAttestation(layer.digest!, bytes, predicateHint),
  );
};

const resolveReferrerDescriptor = async (
  client: RegistryClient,
  reference: string,
  descriptor: OciDescriptor,
  maximum: number,
  state: ReferrerState,
): Promise<void> => {
  if (!descriptor.digest || !descriptor.mediaType) return;
  state.referrers.push({
    digest: descriptor.digest,
    mediaType: descriptor.mediaType,
    artifactType: descriptor.artifactType,
    annotations: descriptor.annotations ?? {},
  });
  const response = await client.request(
    `manifests/${descriptor.digest}`,
    MANIFEST_ACCEPT,
    maximum,
  );
  if (response.status < 200 || response.status >= 300) {
    throw new ImageReferrersResolutionFailedError(
      reference,
      undefined,
      response.status,
    );
  }
  const actualDigest = `sha256:${await sha256Hex(response.bytes)}`;
  if (actualDigest !== descriptor.digest) {
    throw new ImageReferrerDigestMismatchError(descriptor.digest, actualDigest);
  }
  let manifest: { layers?: OciDescriptor[] };
  try {
    manifest = JSON.parse(new TextDecoder().decode(response.bytes));
  } catch (cause) {
    throw new ImageAttestationDecodingFailedError(descriptor.digest, cause);
  }
  for (const layer of manifest.layers ?? []) {
    await resolveAttestationLayer(
      client,
      reference,
      descriptor,
      layer,
      maximum,
      state,
    );
  }
};

const referrerResult = (state: ReferrerState): {
  referrers: ContainerImageReferrer[];
  provenance: ContainerImageProvenance;
  sbom: ContainerImageSbom;
} => ({
  referrers: state.referrers,
  provenance: {
    present: state.provenancePresent,
    parsed: state.provenanceParsed,
    signatureVerified: false,
    predicateTypes: [...state.predicateTypes],
    subjectDigests: [...state.subjectDigests],
    sourceRepositories: [...state.sourceRepositories],
  },
  sbom: {
    present: state.sbomFormats.size > 0,
    formats: [...state.sbomFormats],
  },
});

const resolveReferrers = async (
  client: RegistryClient,
  reference: string,
  digest: string,
  maximum: number,
  maxReferrers: number,
): Promise<{
  referrers: ContainerImageReferrer[];
  provenance: ContainerImageProvenance;
  sbom: ContainerImageSbom;
}> => {
  let response: Awaited<ReturnType<typeof retrievePinnedHttpResource>>;
  try {
    response = await client.request(
      `referrers/${digest}`,
      "application/vnd.oci.image.index.v1+json",
      maximum,
    );
  } catch (cause) {
    if (cause instanceof ImageRegistryRequestRejectedError) throw cause;
    throw new ImageReferrersResolutionFailedError(reference, cause);
  }
  if (response.status === 404) {
    return emptyReferrerResult();
  }
  const descriptors = readReferrerDescriptors(
    reference,
    response,
    maxReferrers,
  );
  const state: ReferrerState = {
    referrers: [],
    predicateTypes: new Set(),
    subjectDigests: new Set(),
    sourceRepositories: new Set(),
    sbomFormats: new Set(),
    provenancePresent: false,
    provenanceParsed: false,
  };
  for (const descriptor of descriptors) {
    await resolveReferrerDescriptor(
      client,
      reference,
      descriptor,
      maximum,
      state,
    );
  }
  return referrerResult(state);
};

/** OCI resolver that separates registry facts from image trust decisions. */
export class OciContainerImageResolver implements ContainerImageResolver {
  readonly #policy: NonNullable<
    OciContainerImageResolverOptions["retrievalPolicy"]
  >;
  readonly #transport: SourceHttpTransport;
  readonly #addressResolver: SourceAddressResolver;
  readonly #downloadTimeoutMs: number;
  readonly #maxRedirects: number;
  readonly #maxMetadataBytes: number;
  readonly #maxReferrers: number;

  /** Creates a resolver with bounded registry metadata ingestion. */
  constructor(options: OciContainerImageResolverOptions = {}) {
    this.#policy = options.retrievalPolicy ??
      new DefaultSourceRetrievalPolicy();
    this.#transport = options.transport ??
      (options.fetch
        ? new FetchImageHttpTransport(options.fetch)
        : new PinnedAddressHttpTransport());
    this.#addressResolver = options.addressResolver ??
      (options.fetch
        ? INJECTED_FETCH_ADDRESS_RESOLVER
        : new DenoSourceAddressResolver());
    this.#downloadTimeoutMs = options.downloadTimeoutMs ??
      DEFAULT_BUILD_VERIFICATION_LIMITS.downloadTimeoutMs;
    this.#maxRedirects = options.maxRedirects ??
      DEFAULT_BUILD_VERIFICATION_LIMITS.maxRedirects;
    this.#maxMetadataBytes = options.maxMetadataBytes ?? 16 * 1024 * 1024;
    this.#maxReferrers = options.maxReferrers ?? 64;
  }

  /** Resolves manifest, image config, provenance, and SBOM observations. */
  async resolve(reference: string): Promise<ContainerImageDetails> {
    const parsed = parseContainerImageReference(reference);
    const client = new RegistryClient(reference, parsed, {
      policy: this.#policy,
      transport: this.#transport,
      addressResolver: this.#addressResolver,
      downloadTimeoutMs: this.#downloadTimeoutMs,
      maxRedirects: this.#maxRedirects,
    });
    const response = await client.request(
      `manifests/${parsed.digest}`,
      MANIFEST_ACCEPT,
      this.#maxMetadataBytes,
    );
    if (response.status < 200 || response.status >= 300) {
      throw new ImageManifestResolutionFailedError(
        reference,
        undefined,
        response.status,
      );
    }
    let manifestBytes: Uint8Array;
    let manifest: { mediaType?: string; config?: OciDescriptor };
    try {
      manifestBytes = response.bytes;
      manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    } catch (cause) {
      throw new ImageManifestResolutionFailedError(
        reference,
        cause,
        response.status,
      );
    }
    const actualDigest = `sha256:${await sha256Hex(manifestBytes)}`;
    if (actualDigest !== parsed.digest) {
      throw new ImageManifestDigestMismatchError(
        reference,
        parsed.digest,
        actualDigest,
      );
    }
    const mediaType = manifest.mediaType ??
      response.headers["content-type"]?.split(";", 1)[0] ?? "";
    if (INDEX_MEDIA_TYPES.has(mediaType)) {
      throw new MultiArchImageError(reference, mediaType);
    }
    if (!manifest.config) {
      throw new ImageConfigResolutionFailedError(
        reference,
        new TypeError("Image manifest omitted its config descriptor"),
      );
    }
    let config: {
      architecture?: string;
      os?: string;
      config?: {
        Entrypoint?: string[];
        WorkingDir?: string;
        Env?: string[];
        User?: string;
      };
    };
    try {
      const configBytes = await fetchDescriptorBytes(
        client,
        reference,
        manifest.config,
        this.#maxMetadataBytes,
        "config",
      );
      config = JSON.parse(new TextDecoder().decode(configBytes));
    } catch (cause) {
      if (
        cause instanceof ImageConfigResolutionFailedError ||
        cause instanceof ImageConfigDigestMismatchError
      ) throw cause;
      throw new ImageConfigResolutionFailedError(reference, cause);
    }
    const attestations = await resolveReferrers(
      client,
      reference,
      parsed.digest,
      this.#maxMetadataBytes,
      this.#maxReferrers,
    );
    const environment = config.config?.Env ?? [];
    const toolchain = environment.find((entry) =>
      entry.startsWith("RUSTUP_TOOLCHAIN=")
    )?.slice("RUSTUP_TOOLCHAIN=".length);
    return {
      reference,
      registry: parsed.registry,
      repository: parsed.repository,
      requestedDigest: parsed.digest,
      manifestDigest: actualDigest,
      manifestMediaType: mediaType,
      resolvedThroughIndex: false,
      architecture: config.architecture,
      os: config.os,
      configDigest: manifest.config.digest,
      entrypoint: config.config?.Entrypoint,
      workingDirectory: config.config?.WorkingDir,
      environment,
      user: config.config?.User,
      rustupToolchain: toolchain,
      ...attestations,
    };
  }
}

/** Resolves one image through the default OCI resolver. */
export function resolveContainerImage(
  reference: string,
  options?: OciContainerImageResolverOptions,
): Promise<ContainerImageDetails>;
/** Resolves one image through an explicitly controlled fetch boundary. */
export function resolveContainerImage(
  reference: string,
  fetcher: typeof fetch,
): Promise<ContainerImageDetails>;
export function resolveContainerImage(
  reference: string,
  options: OciContainerImageResolverOptions | typeof fetch = {},
): Promise<ContainerImageDetails> {
  return new OciContainerImageResolver(
    typeof options === "function" ? { fetch: options } : options,
  ).resolve(reference);
}
