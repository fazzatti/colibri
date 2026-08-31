import type { ContainerImageDetails } from "@/core/policy/types.ts";
import type { SourceRetrievalPolicy } from "@/core/policy/types.ts";
import type {
  SourceAddressResolver,
  SourceHttpTransport,
} from "@/providers/source/types.ts";

/** Boundary used to resolve OCI image, runtime, and attestation facts. */
export interface ContainerImageResolver {
  /** Resolves one digest-pinned image without making a trust decision. */
  resolve(reference: string): Promise<ContainerImageDetails>;
}

/** Options used by the default OCI image resolver. */
export type OciContainerImageResolverOptions = {
  readonly fetch?: typeof globalThis.fetch;
  readonly retrievalPolicy?: SourceRetrievalPolicy;
  readonly transport?: SourceHttpTransport;
  readonly addressResolver?: SourceAddressResolver;
  readonly downloadTimeoutMs?: number;
  readonly maxRedirects?: number;
  readonly maxMetadataBytes?: number;
  readonly maxReferrers?: number;
};
