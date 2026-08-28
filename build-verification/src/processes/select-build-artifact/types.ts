import type { BuildArtifactCandidate } from "../../artifacts/types.ts";
import type {
  BuildVerificationLimits,
  VerificationState,
} from "../../core/index.ts";
import type { VerificationLogging } from "../../reporting/types.ts";
import type { ExecutedContractBuildValue } from "../execute-contract-build/types.ts";

/** Active value produced after deterministic artifact selection. */
export type SelectedBuildArtifactValue = ExecutedContractBuildValue & {
  readonly artifact: BuildArtifactCandidate;
};

/** Input accepted by {@link selectBuildArtifact}. */
export type SelectBuildArtifactInput = {
  readonly state: VerificationState<ExecutedContractBuildValue>;
  readonly limits: BuildVerificationLimits;
  readonly logging?: VerificationLogging;
  readonly now?: () => string;
};

/** Output produced by {@link selectBuildArtifact}. */
export type SelectBuildArtifactOutput = VerificationState<
  SelectedBuildArtifactValue
>;
