import type { ContractBuildVerificationResult } from "@/core/index.ts";

const oneLine = (value: string): string => value.replace(/\s+/g, " ").trim();

const notApplicableReason = (
  reason: Extract<
    ContractBuildVerificationResult,
    { status: "notApplicable" }
  >["reason"],
): string =>
  reason === "missingSep58Metadata"
    ? "SEP-58 metadata was not found"
    : "target is a Stellar Asset Contract";

const verifiedHash = (
  result: Extract<
    ContractBuildVerificationResult,
    { status: "verified" | "mismatch" }
  >,
): string | undefined =>
  result.evidence.artifact?.sha256 ?? result.evidence.target?.wasmHash;

/** Formats one completed verification result for concise terminal output. */
export const formatBuildVerificationResultSummary = (
  result: ContractBuildVerificationResult,
): string => {
  switch (result.status) {
    case "verified": {
      const hash = verifiedHash(result);
      return hash ? `VERIFIED ${hash}` : "VERIFIED";
    }
    case "mismatch": {
      const target = result.evidence.target?.wasmHash ?? "unknown";
      const rebuilt = result.evidence.artifact?.sha256 ?? "unknown";
      return `MISMATCH target=${target} rebuilt=${rebuilt}`;
    }
    case "notApplicable": {
      const target = result.targetWasmHash ??
        result.evidence.target?.wasmHash;
      const reason = notApplicableReason(result.reason);
      return target
        ? `NOT_APPLICABLE ${reason} target=${target}`
        : `NOT_APPLICABLE ${reason}`;
    }
  }
};

/** Formats one typed Colibri failure for concise terminal output. */
export const formatBuildVerificationErrorSummary = (
  error: {
    readonly code: string;
    readonly message: string;
    readonly details?: string;
  },
): string => {
  const message = oneLine(error.message);
  const details = oneLine(error.details ?? "");
  return details
    ? `ERROR ${error.code} ${message}: ${details}`
    : `ERROR ${error.code} ${message}`;
};
