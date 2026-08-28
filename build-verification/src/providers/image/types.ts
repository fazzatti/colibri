import type { ContainerImageDetails } from "../../core/policy/types.ts";

/** Boundary used to resolve OCI image, runtime, and attestation facts. */
export interface ContainerImageResolver {
  /** Resolves one digest-pinned image without making a trust decision. */
  resolve(reference: string): Promise<ContainerImageDetails>;
}

/** Options used by the default OCI image resolver. */
export type OciContainerImageResolverOptions = {
  readonly fetch?: typeof globalThis.fetch;
  readonly maxMetadataBytes?: number;
  readonly maxReferrers?: number;
};
