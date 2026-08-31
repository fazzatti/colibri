import type {
  ContractBuildVerificationResult,
  VerificationLogEvent,
} from "@/core/types/result.ts";
import type { ContractBuildVerificationEvidence } from "@/core/types/result.ts";

/** Active pipeline state carrying one stage value and accumulated evidence. */
export type ActiveVerificationState<Value> = {
  readonly state: "active";
  readonly value: Value;
  readonly evidence: ContractBuildVerificationEvidence;
  readonly logs: readonly VerificationLogEvent[];
};

/** Early terminal pipeline state for a standards-defined inapplicable target. */
export type CompleteVerificationState = {
  readonly state: "complete";
  readonly result: Extract<
    ContractBuildVerificationResult,
    { readonly status: "notApplicable" }
  >;
};

/** Discriminated state shared by every conditional verification process. */
export type VerificationState<Value> =
  | ActiveVerificationState<Value>
  | CompleteVerificationState;

/** Returns whether a pipeline state has already completed. */
export const isCompleteVerificationState = <Value>(
  state: VerificationState<Value>,
): state is CompleteVerificationState => state.state === "complete";
