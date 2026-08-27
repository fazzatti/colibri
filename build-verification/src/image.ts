import {
  ImageManifestResolutionFailedError,
  ImagePolicyRejectedError,
  InvalidImageReferenceError,
  MultiArchImageError,
} from "@/error.ts";
import { sha256Hex } from "@/hash.ts";
import type { ContainerImageDetails, ContainerImagePolicy } from "@/types.ts";

const IMAGE_PATTERN =
  /^(?:localhost(?::\d+)?|[^\s@/]*[.:][^\s@/]*)\/[^\s@]+@sha256:[0-9a-f]{64}$/;
const MANIFEST_ACCEPT = [
  "application/vnd.oci.image.manifest.v1+json",
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.v2+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
].join(", ");

const discardResponseBody = async (response: Response): Promise<void> => {
  try {
    await response.body?.cancel();
  } catch {
    // The registry status remains the authoritative failure.
  }
};
const INDEX_MEDIA_TYPES = new Set([
  "application/vnd.oci.image.index.v1+json",
  "application/vnd.docker.distribution.manifest.list.v2+json",
]);

type ParsedImageReference = {
  registry: string;
  repository: string;
  digest: string;
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
    [...header.slice(7).matchAll(/([a-z]+)="([^"]*)"/g)].map((
      match,
    ) => [match[1], match[2]]),
  );
  if (!values.realm) return null;
  const url = new URL(values.realm);
  if (values.service) url.searchParams.set("service", values.service);
  if (values.scope) url.searchParams.set("scope", values.scope);
  return url;
};

const fetchManifest = async (
  reference: string,
  parsed: ParsedImageReference,
  fetcher: typeof fetch,
): Promise<Response> => {
  const url = `${
    registryOrigin(parsed.registry)
  }/v2/${parsed.repository}/manifests/${parsed.digest}`;
  let response: Response;
  try {
    response = await fetcher(url, { headers: { accept: MANIFEST_ACCEPT } });
  } catch (cause) {
    throw new ImageManifestResolutionFailedError(reference, cause);
  }
  if (response.status !== 401) return response;

  const tokenUrl = parseBearerChallenge(
    response.headers.get("www-authenticate"),
  );
  await discardResponseBody(response);
  if (!tokenUrl) {
    throw new ImageManifestResolutionFailedError(
      reference,
      undefined,
      response.status,
    );
  }
  let tokenResponse: Response;
  try {
    tokenResponse = await fetcher(tokenUrl, {
      headers: { accept: "application/json" },
    });
  } catch (cause) {
    throw new ImageManifestResolutionFailedError(reference, cause);
  }
  if (!tokenResponse.ok) {
    await discardResponseBody(tokenResponse);
    throw new ImageManifestResolutionFailedError(
      reference,
      undefined,
      tokenResponse.status,
    );
  }
  let token: string | undefined;
  try {
    const body = await tokenResponse.json() as {
      token?: string;
      access_token?: string;
    };
    token = body.token ?? body.access_token;
  } catch (cause) {
    throw new ImageManifestResolutionFailedError(
      reference,
      cause,
      tokenResponse.status,
    );
  }
  if (!token) {
    throw new ImageManifestResolutionFailedError(
      reference,
      undefined,
      tokenResponse.status,
    );
  }
  try {
    return await fetcher(url, {
      headers: { accept: MANIFEST_ACCEPT, authorization: `Bearer ${token}` },
    });
  } catch (cause) {
    throw new ImageManifestResolutionFailedError(reference, cause);
  }
};

/** Resolves a digest-pinned OCI image and rejects multi-platform indexes. */
export const resolveContainerImage = async (
  reference: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<ContainerImageDetails> => {
  const parsed = parseImageReference(reference);
  const response = await fetchManifest(reference, parsed, fetcher);
  if (!response.ok) {
    await discardResponseBody(response);
    throw new ImageManifestResolutionFailedError(
      reference,
      undefined,
      response.status,
    );
  }
  let bytes: Uint8Array;
  let manifest: { mediaType?: string; architecture?: string; os?: string };
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
    manifest = JSON.parse(new TextDecoder().decode(bytes));
  } catch (cause) {
    throw new ImageManifestResolutionFailedError(
      reference,
      cause,
      response.status,
    );
  }
  const actualDigest = `sha256:${await sha256Hex(bytes)}`;
  if (actualDigest !== parsed.digest) {
    throw new ImageManifestResolutionFailedError(
      reference,
      undefined,
      response.status,
    );
  }
  const mediaType = manifest.mediaType ??
    response.headers.get("content-type")?.split(";", 1)[0] ?? "";
  if (INDEX_MEDIA_TYPES.has(mediaType)) {
    throw new MultiArchImageError(reference, mediaType);
  }
  return {
    reference,
    registry: parsed.registry,
    repository: parsed.repository,
    digest: parsed.digest,
    mediaType,
    architecture: manifest.architecture,
    os: manifest.os,
  };
};

/** Default policy that accepts only digest-pinned official Stellar CLI images. */
export class OfficialStellarImagePolicy implements ContainerImagePolicy {
  /** Ensures the image belongs to the canonical Stellar CLI repository. */
  validate(details: ContainerImageDetails): void {
    if (
      details.registry !== "docker.io" ||
      details.repository !== "stellar/stellar-cli"
    ) {
      throw new ImagePolicyRejectedError(
        details.reference,
        "The default policy accepts only docker.io/stellar/stellar-cli. Supply a custom image policy to trust another repository.",
      );
    }
  }
}
