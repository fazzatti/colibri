import type { ContractBuildVerificationEvidence } from "@/core/types/result.ts";

/** Top-level immutable evidence refinement applied by one process. */
export type VerificationEvidencePatch = Partial<
  Omit<ContractBuildVerificationEvidence, "package" | "mode" | "logs">
>;
