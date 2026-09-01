import type { ColibriError } from "@colibri/core";
import type {
  ContractBuildVerificationEvidence,
  VerificationLogEvent,
} from "@/core/index.ts";
import type { JsonValue } from "@/core/policy/types.ts";
import type { BuildVerificationFailureReport } from "@/reporting/types.ts";
import { serializeBuildVerificationError } from "@/reporting/serialize-error.ts";

const errorData = (
  error: ColibriError,
): Readonly<Record<string, unknown>> | undefined => {
  const data = error.meta?.data;
  return data && typeof data === "object"
    ? data as Readonly<Record<string, unknown>>
    : undefined;
};

const contextualEvidence = (
  data: Readonly<Record<string, unknown>> | undefined,
): ContractBuildVerificationEvidence | undefined => {
  const evidence = data?.evidence;
  if (!evidence || typeof evidence !== "object") return undefined;
  if (!("package" in evidence) || !("logs" in evidence)) return undefined;
  return evidence as ContractBuildVerificationEvidence;
};

const contextualLogs = (
  data: Readonly<Record<string, unknown>> | undefined,
  evidence?: ContractBuildVerificationEvidence,
): readonly VerificationLogEvent[] => {
  const logs = data?.logs;
  return Array.isArray(logs)
    ? logs as readonly VerificationLogEvent[]
    : evidence?.logs ?? [];
};

const serializedErrorWithoutReportContext = (
  error: ColibriError,
  data: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> => {
  const serialized = serializeBuildVerificationError(error);
  if (!data) return serialized;
  const meta = serialized.meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return serialized;
  }
  const serializedMeta = meta as Readonly<Record<string, JsonValue>>;
  const serializedData = serializedMeta.data;
  if (
    !serializedData || typeof serializedData !== "object" ||
    Array.isArray(serializedData)
  ) {
    return serialized;
  }
  const { evidence: _evidence, logs: _logs, ...remainingData } =
    serializedData as Readonly<Record<string, JsonValue>>;
  return {
    ...serialized,
    meta: { ...serializedMeta, data: remainingData },
  };
};

/** Builds a serializable report from one typed CLI or verification failure. */
export const buildVerificationFailureReport = (
  error: ColibriError,
  fallbackEvidence?: ContractBuildVerificationEvidence,
): BuildVerificationFailureReport => {
  const data = errorData(error);
  const evidence = contextualEvidence(data) ?? fallbackEvidence;
  return {
    status: "failed",
    error: serializedErrorWithoutReportContext(error, data),
    evidence,
    logs: contextualLogs(data, evidence),
  };
};
