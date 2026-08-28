import type { ContainerImageDetails } from "../policy/types.ts";
import type {
  ContractBuildVerificationEvidence,
  VerificationImageEvidence,
  VerificationLogEvent,
} from "../types/result.ts";
import { attachVerificationLogs } from "./accumulate.ts";

const environmentName = (entry: string): string =>
  entry.split("=", 1)[0] || "<unnamed>";

/** Removes container environment values before image facts enter evidence. */
export const imageDetailsForEvidence = (
  details: ContainerImageDetails,
): VerificationImageEvidence["details"] => {
  const { environment, ...serializable } = details;
  return {
    ...serializable,
    environmentVariableNames: environment.map(environmentName),
  };
};

/** Finalizes one evidence value with its exact bounded structured logs. */
export const finalizeVerificationEvidence = (
  evidence: ContractBuildVerificationEvidence,
  logs: readonly VerificationLogEvent[],
): ContractBuildVerificationEvidence => attachVerificationLogs(evidence, logs);
