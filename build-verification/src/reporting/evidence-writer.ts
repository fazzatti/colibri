import { basename, dirname, resolve } from "node:path";
import type {
  ContractBuildVerificationEvidence,
  ContractBuildVerificationResult,
} from "../core/types/result.ts";
import { EvidenceWriteFailedError } from "./error.ts";

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

/** Writes verification evidence as stable, indented JSON via atomic replace. */
export const writeVerificationEvidence = async (
  path: string,
  value: ContractBuildVerificationEvidence | ContractBuildVerificationResult,
): Promise<void> => {
  const evidence = "status" in value ? value.evidence : value;
  try {
    await atomicTextWrite(path, `${JSON.stringify(evidence, null, 2)}\n`);
  } catch (cause) {
    throw new EvidenceWriteFailedError(path, cause);
  }
};
