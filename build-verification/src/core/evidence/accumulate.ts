import type { ContractBuildVerificationMode } from "@/core/types/input.ts";
import type {
  ContractBuildVerificationEvidence,
  VerificationLogEvent,
} from "@/core/types/result.ts";
import type { VerificationEvidencePatch } from "@/core/evidence/types.ts";

/** Version recorded in evidence produced by this package release. */
export const BUILD_VERIFICATION_PACKAGE_VERSION = "0.3.0";

/** Creates the immutable evidence seed for one pipeline execution. */
export const createVerificationEvidence = (
  mode: ContractBuildVerificationMode,
  observedAt: string,
): ContractBuildVerificationEvidence =>
  Object.freeze({
    package: {
      name: "@colibri/build-verification" as const,
      version: BUILD_VERIFICATION_PACKAGE_VERSION,
    },
    mode,
    logs: Object.freeze([]),
    observedAt,
  });

/** Returns a new evidence value with one stage refinement applied. */
export const accumulateVerificationEvidence = (
  evidence: ContractBuildVerificationEvidence,
  patch: VerificationEvidencePatch,
): ContractBuildVerificationEvidence =>
  Object.freeze({
    ...evidence,
    ...patch,
  });

/** Returns a new evidence value containing the exact bounded log sequence. */
export const attachVerificationLogs = (
  evidence: ContractBuildVerificationEvidence,
  logs: readonly VerificationLogEvent[],
): ContractBuildVerificationEvidence =>
  Object.freeze({
    ...evidence,
    logs: Object.freeze([...logs]),
  });
