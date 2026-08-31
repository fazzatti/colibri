import { sha256Hex } from "@/core/comparison/compare-wasm.ts";
import type {
  ContainerImageDetails,
  ContainerImageProvenance,
  ContainerImageReferrer,
  ContainerImageSbom,
} from "@/core/policy/types.ts";
import type {
  ContainerImageResolver,
  OciContainerImageResolverOptions,
} from "@/providers/image/types.ts";
import {
  ImageAttestationDecodingFailedError,
  ImageConfigDigestMismatchError,
  ImageConfigResolutionFailedError,
  ImageManifestDigestMismatchError,
  ImageManifestResolutionFailedError,
  ImageReferrerDigestMismatchError,
  ImageReferrersResolutionFailedError,
  InvalidImageReferenceError,
  MultiArchImageError,
} from "@/providers/image/error.ts";

const IMAGE_PATTERN =
  /^(?:localhost(?::\d+)?|[^\s@/]*[.:][^\s@/]*)\/[^\s@]+@sha256:[0-9a-f]{64}$/;
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

type ParsedImageReference = {
  readonly registry: string;
  readonly repository: string;
  readonly digest: string;
};

type OciDescriptor = {
  readonly mediaType?: string;
  readonly digest?: string;
  readonly size?: number;
  readonly artifactType?: string;
  readonly annotations?: Record<string, string>;
};

const parseImageReference = (reference: string): ParsedImageReference => {
  if (!IMAGE_PATTERN.test(reference)) {
    throw new InvalidImageReferenceError(reference);
  }
  const slash = reference.indexOf("/");
  const at = reference.lastIndexOf("@");
  return {
    registry: reference.slice(0, slash),
    repository: reference.slice(slash + 1, at),
    digest: reference.slice(at + 1),
  };
};

const registryOrigin = (registry: string): string => {
  if (registry === "docker.io") return "https://registry-1.docker.io";
  return `${registry.startsWith("localhost") ? "http" : "https"}://${registry}`;
};

const parseBearerChallenge = (header: string | null): URL | null => {
  if (!header?.startsWith("Bearer ")) return null;
  const values = Object.fromEntries(
    [...header.slice(7).matchAll(/([a-z]+)="([^"]*)"/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  if (!values.realm) return null;
  const url = new URL(values.realm);
  if (values.service) url.searchParams.set("service", values.service);
  if (values.scope) url.searchParams.set("scope", values.scope);
  return url;
};

const discardResponse = async (response: Response): Promise<void> => {
  try {
    await response.body?.cancel();
  } catch {
    // The response status remains the authoritative registry failure.
  }
};

class RegistryClient {
  readonly #reference: string;
  readonly #parsed: ParsedImageReference;
  readonly #fetcher: typeof fetch;
  #token?: string;

  constructor(
    reference: string,
    parsed: ParsedImageReference,
    fetcher: typeof fetch,
  ) {
    this.#reference = reference;
    this.#parsed = parsed;
    this.#fetcher = fetcher;
  }

  async #fetch(input: string | URL, init: RequestInit): Promise<Response> {
    let lastCause: unknown;
    for (const delayMs of REGISTRY_FETCH_RETRY_DELAYS_MS) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      try {
        return await this.#fetcher(input, init);
      } catch (cause) {
        lastCause = cause;
      }
    }
    throw lastCause;
  }

  async request(path: string, accept: string): Promise<Response> {
    const url = `${
      registryOrigin(this.#parsed.registry)
    }/v2/${this.#parsed.repository}/${path}`;
    let response: Response;
    try {
      response = await this.#fetch(url, {
        headers: {
          accept,
          ...(this.#token ? { authorization: `Bearer ${this.#token}` } : {}),
        },
      });
    } catch (cause) {
      throw new ImageManifestResolutionFailedError(this.#reference, cause);
    }
    if (response.status !== 401 || this.#token) return response;
    const tokenUrl = parseBearerChallenge(
      response.headers.get("www-authenticate"),
    );
    await discardResponse(response);
    if (!tokenUrl) {
      throw new ImageManifestResolutionFailedError(
        this.#reference,
        undefined,
        response.status,
      );
    }
    let tokenResponse: Response;
    try {
      tokenResponse = await this.#fetch(tokenUrl, {
        headers: { accept: "application/json" },
      });
    } catch (cause) {
      throw new ImageManifestResolutionFailedError(this.#reference, cause);
    }
    if (!tokenResponse.ok) {
      await discardResponse(tokenResponse);
      throw new ImageManifestResolutionFailedError(
        this.#reference,
        undefined,
        tokenResponse.status,
      );
    }
    try {
      const body = await tokenResponse.json() as {
        token?: string;
        access_token?: string;
      };
      this.#token = body.token ?? body.access_token;
    } catch (cause) {
      throw new ImageManifestResolutionFailedError(
        this.#reference,
        cause,
        tokenResponse.status,
      );
    }
    if (!this.#token) {
      throw new ImageManifestResolutionFailedError(
        this.#reference,
        undefined,
        tokenResponse.status,
      );
    }
    try {
      return await this.#fetch(url, {
        headers: { accept, authorization: `Bearer ${this.#token}` },
      });
    } catch (cause) {
      throw new ImageManifestResolutionFailedError(this.#reference, cause);
    }
  }
}

const boundedBytes = async (
  response: Response,
  maximum: number,
): Promise<Uint8Array> => {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximum) {
    throw new RangeError("OCI metadata exceeds its configured byte limit");
  }
  if (!response.body) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > maximum) {
      throw new RangeError("OCI metadata exceeds its configured byte limit");
    }
    chunks.push(Uint8Array.from(chunk));
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
};

const fetchDescriptorBytes = async (
  client: RegistryClient,
  descriptor: OciDescriptor,
  maximum: number,
  owner: "config" | "referrer",
): Promise<Uint8Array> => {
  if (!descriptor.digest || !/^sha256:[0-9a-f]{64}$/.test(descriptor.digest)) {
    throw new TypeError(`OCI ${owner} descriptor omitted a sha256 digest`);
  }
  const response = await client.request(
    `blobs/${descriptor.digest}`,
    descriptor.mediaType ?? "application/octet-stream",
  );
  if (!response.ok) {
    await discardResponse(response);
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
  const bytes = await boundedBytes(response, maximum);
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
  let response: Response;
  try {
    response = await client.request(
      `referrers/${digest}`,
      "application/vnd.oci.image.index.v1+json",
    );
  } catch (cause) {
    throw new ImageReferrersResolutionFailedError(reference, cause);
  }
  if (response.status === 404) {
    await discardResponse(response);
    return {
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
    };
  }
  if (!response.ok) {
    await discardResponse(response);
    throw new ImageReferrersResolutionFailedError(
      reference,
      undefined,
      response.status,
    );
  }
  let descriptors: OciDescriptor[];
  try {
    const index = JSON.parse(
      new TextDecoder().decode(await boundedBytes(response, maximum)),
    ) as { manifests?: OciDescriptor[] };
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

  const referrers: ContainerImageReferrer[] = [];
  const predicateTypes = new Set<string>();
  const subjectDigests = new Set<string>();
  const sourceRepositories = new Set<string>();
  const sbomFormats = new Set<string>();
  let provenancePresent = false;
  let provenanceParsed = false;
  for (const descriptor of descriptors) {
    if (!descriptor.digest || !descriptor.mediaType) continue;
    referrers.push({
      digest: descriptor.digest,
      mediaType: descriptor.mediaType,
      artifactType: descriptor.artifactType,
      annotations: descriptor.annotations ?? {},
    });
    const manifestResponse = await client.request(
      `manifests/${descriptor.digest}`,
      MANIFEST_ACCEPT,
    );
    if (!manifestResponse.ok) {
      await discardResponse(manifestResponse);
      throw new ImageReferrersResolutionFailedError(
        reference,
        undefined,
        manifestResponse.status,
      );
    }
    const manifestBytes = await boundedBytes(manifestResponse, maximum);
    const manifestActual = `sha256:${await sha256Hex(manifestBytes)}`;
    if (manifestActual !== descriptor.digest) {
      throw new ImageReferrerDigestMismatchError(
        descriptor.digest,
        manifestActual,
      );
    }
    let manifest: { layers?: OciDescriptor[] };
    try {
      manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    } catch (cause) {
      throw new ImageAttestationDecodingFailedError(descriptor.digest, cause);
    }
    for (const layer of manifest.layers ?? []) {
      const predicateHint = layer.annotations?.["in-toto.io/predicate-type"] ??
        descriptor.annotations?.["in-toto.io/predicate-type"] ?? "";
      const isAttestation = layer.mediaType?.includes("in-toto") ||
        predicateHint.length > 0;
      if (!isAttestation) continue;
      const bytes = await fetchDescriptorBytes(
        client,
        layer,
        maximum,
        "referrer",
      );
      const parsed = parseAttestation(layer.digest!, bytes, predicateHint);
      if (parsed.kind === "provenance") {
        provenancePresent = true;
        provenanceParsed = true;
        if (parsed.predicateType) predicateTypes.add(parsed.predicateType);
        for (const subject of parsed.subjects) subjectDigests.add(subject);
        for (const source of parsed.sources) sourceRepositories.add(source);
      } else if (parsed.kind === "sbom") {
        if (parsed.format) sbomFormats.add(parsed.format);
      }
    }
  }
  return {
    referrers,
    provenance: {
      present: provenancePresent,
      parsed: provenanceParsed,
      signatureVerified: false,
      predicateTypes: [...predicateTypes],
      subjectDigests: [...subjectDigests],
      sourceRepositories: [...sourceRepositories],
    },
    sbom: { present: sbomFormats.size > 0, formats: [...sbomFormats] },
  };
};

/** OCI resolver that separates registry facts from image trust decisions. */
export class OciContainerImageResolver implements ContainerImageResolver {
  readonly #fetcher: typeof fetch;
  readonly #maxMetadataBytes: number;
  readonly #maxReferrers: number;

  /** Creates a resolver with bounded registry metadata ingestion. */
  constructor(options: OciContainerImageResolverOptions = {}) {
    this.#fetcher = options.fetch ?? globalThis.fetch;
    this.#maxMetadataBytes = options.maxMetadataBytes ?? 16 * 1024 * 1024;
    this.#maxReferrers = options.maxReferrers ?? 64;
  }

  /** Resolves manifest, image config, provenance, and SBOM observations. */
  async resolve(reference: string): Promise<ContainerImageDetails> {
    const parsed = parseImageReference(reference);
    const client = new RegistryClient(reference, parsed, this.#fetcher);
    const response = await client.request(
      `manifests/${parsed.digest}`,
      MANIFEST_ACCEPT,
    );
    if (!response.ok) {
      await discardResponse(response);
      throw new ImageManifestResolutionFailedError(
        reference,
        undefined,
        response.status,
      );
    }
    let manifestBytes: Uint8Array;
    let manifest: { mediaType?: string; config?: OciDescriptor };
    try {
      manifestBytes = await boundedBytes(response, this.#maxMetadataBytes);
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
      response.headers.get("content-type")?.split(";", 1)[0] ?? "";
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
export const resolveContainerImage = (
  reference: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<ContainerImageDetails> =>
  new OciContainerImageResolver({ fetch: fetcher }).resolve(reference);
