import type {
  ResolvedVerificationTarget,
  VerificationNetworkEvidence,
  VerificationTarget,
} from "@/core/types/index.ts";

/** Input passed to a verification-target resolver. */
export type VerificationTargetResolverInput = {
  readonly target: VerificationTarget;
};

/** Boundary used to resolve direct or network-backed target Wasm. */
export interface VerificationTargetResolver {
  /** Resolves exact target facts without parsing build metadata. */
  resolve(
    input: VerificationTargetResolverInput,
  ): Promise<ResolvedVerificationTarget>;
}

/**
 * Network facts normalized once for the default target resolver.
 * @internal
 */
export type NormalizedVerificationNetwork = {
  readonly ledgerEntries: import("@colibri/core").LedgerEntries;
  readonly evidence: VerificationNetworkEvidence;
};
