import type {
  BuildVerificationLimits,
  ContractBuildVerificationInput,
  ContractBuildVerificationMode,
  ResolvedVerificationTarget,
  VerificationNetworkEvidence,
  VerificationState,
} from "@/core/types/index.ts";
import type { VerificationLogging } from "@/reporting/types.ts";
import type { VerificationTargetResolver } from "@/providers/target/types.ts";

/** Active value produced after exact target resolution. */
export type ResolvedVerificationTargetValue = {
  readonly request: ContractBuildVerificationInput;
  readonly mode: ContractBuildVerificationMode;
  readonly target: Extract<
    ResolvedVerificationTarget,
    { readonly applicability: "wasm" }
  >;
};

/** Input accepted by {@link resolveVerificationTarget}. */
export type ResolveVerificationTargetInput = {
  readonly request: ContractBuildVerificationInput;
  readonly resolver: VerificationTargetResolver;
  readonly networkEvidence?: VerificationNetworkEvidence;
  readonly limits: BuildVerificationLimits;
  readonly logging?: VerificationLogging;
  readonly now?: () => string;
};

/** Output produced by {@link resolveVerificationTarget}. */
export type ResolveVerificationTargetOutput = VerificationState<
  ResolvedVerificationTargetValue
>;
