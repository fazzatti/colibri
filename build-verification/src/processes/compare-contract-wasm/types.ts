import type {
  BuildVerificationLimits,
  ContractBuildVerificationResult,
  VerificationState,
} from "../../core/index.ts";
import type { VerificationLogging } from "../../reporting/types.ts";
import type { SelectedBuildArtifactValue } from "../select-build-artifact/types.ts";

/** Input accepted by {@link compareContractWasm}. */
export type CompareContractWasmInput = {
  readonly state: VerificationState<SelectedBuildArtifactValue>;
  readonly limits: BuildVerificationLimits;
  readonly logging?: VerificationLogging;
  readonly now?: () => string;
};

/** Final output produced by {@link compareContractWasm}. */
export type CompareContractWasmOutput = ContractBuildVerificationResult;
