import { basename, dirname, resolve } from "node:path";
import type {
  ContractBuildVerificationEvidence,
  ContractBuildVerificationResult,
} from "@/core/types/result.ts";
import { EvidenceWriteFailedError } from "@/reporting/error.ts";
import type { BuildVerificationFailureReport } from "@/reporting/types.ts";

const atomicTextWrite = async (path: string, value: string): Promise<void> => {
  const target = resolve(path);
  const temporary = resolve(
    dirname(target),
    `.${basename(target)}.${crypto.randomUUID()}.tmp`,
  );
  try {
    await Deno.writeTextFile(temporary, value, { createNew: true });
    await Deno.rename(temporary, target);
  } catch (cause) {
    await Deno.remove(temporary).catch(() => undefined);
    throw cause;
  }
};

/** Writes completed evidence or a failure report as stable, indented JSON. */
export const writeVerificationEvidence = async (
  path: string,
  value:
    | ContractBuildVerificationEvidence
    | ContractBuildVerificationResult
    | BuildVerificationFailureReport,
): Promise<void> => {
  const evidence = "status" in value
    ? value.status === "failed" ? value : value.evidence
    : value;
  try {
    await atomicTextWrite(path, `${JSON.stringify(evidence, null, 2)}\n`);
  } catch (cause) {
    throw new EvidenceWriteFailedError(path, cause);
  }
};
