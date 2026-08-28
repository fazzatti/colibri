import {
  attachBuildVerificationErrorContext,
  BuildVerificationError,
} from "../error/base.ts";
import type {
  BuildVerificationLimits,
  ContractBuildVerificationEvidence,
  ContractBuildVerificationResult,
  VerificationLogEvent,
} from "../core/types/index.ts";
import { finalizeVerificationEvidence } from "../core/evidence/finalize.ts";
import { recordVerificationLog } from "../reporting/logger.ts";
import type { VerificationLogging } from "../reporting/types.ts";

/** Common process dependencies for bounded logs and deterministic timestamps. */
export type VerificationProcessRuntime = {
  readonly limits: BuildVerificationLimits;
  readonly logging?: VerificationLogging;
  readonly now?: () => string;
};

/** Returns an ISO timestamp from an injected or system clock. */
export const processTimestamp = (runtime: VerificationProcessRuntime): string =>
  runtime.now?.() ?? new Date().toISOString();

/** Records one stage event through the shared bounded logging behavior. */
export const recordProcessEvent = (
  runtime: VerificationProcessRuntime,
  logs: readonly VerificationLogEvent[],
  event: Omit<VerificationLogEvent, "timestamp">,
): Promise<readonly VerificationLogEvent[]> =>
  recordVerificationLog({
    event: { ...event, timestamp: processTimestamp(runtime) },
    logs,
    limits: runtime.limits,
    logging: runtime.logging,
  });

/** Attaches redacted process context while preserving an existing typed error. */
export const contextualizeProcessError = (
  error: unknown,
  fallback: BuildVerificationError,
  context: {
    readonly input?: unknown;
    readonly evidence?: ContractBuildVerificationEvidence;
    readonly logs?: readonly VerificationLogEvent[];
  },
): BuildVerificationError =>
  attachBuildVerificationErrorContext(
    error instanceof BuildVerificationError ? error : fallback,
    context,
  );

/** Builds one complete not-applicable result with bounded logs attached. */
export const completeNotApplicable = (
  reason: "stellarAssetContract" | "missingSep58Metadata",
  evidence: ContractBuildVerificationEvidence,
  logs: readonly VerificationLogEvent[],
  targetWasmHash?: string,
): Extract<ContractBuildVerificationResult, { status: "notApplicable" }> => ({
  status: "notApplicable",
  reason,
  targetWasmHash,
  evidence: finalizeVerificationEvidence(evidence, logs),
});
