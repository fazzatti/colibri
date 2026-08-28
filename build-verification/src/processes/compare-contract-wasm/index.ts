import { compareWasmBytes } from "../../core/comparison/compare-wasm.ts";
import { accumulateVerificationEvidence } from "../../core/evidence/accumulate.ts";
import { finalizeVerificationEvidence } from "../../core/evidence/finalize.ts";
import { redactContractBuildVerificationInput } from "../../core/types/input.ts";
import {
  contextualizeProcessError,
  processTimestamp,
  recordProcessEvent,
} from "../shared.ts";
import { CompareContractWasmUnexpectedError } from "./error.ts";
import type {
  CompareContractWasmInput,
  CompareContractWasmOutput,
} from "./types.ts";

/** Compares exact raw Wasm bytes and creates the only verified/mismatch result. */
export const compareContractWasm = async (
  input: CompareContractWasmInput,
): Promise<CompareContractWasmOutput> => {
  if (input.state.state === "complete") return input.state.result;
  let evidence = input.state.evidence;
  let logs = input.state.logs;
  try {
    const equal = compareWasmBytes(
      input.state.value.target.wasm,
      input.state.value.artifact.bytes,
    );
    evidence = accumulateVerificationEvidence(evidence, {
      comparison: {
        equal,
        targetLength: input.state.value.target.wasm.length,
        rebuiltLength: input.state.value.artifact.bytes.length,
      },
      observedAt: processTimestamp(input),
    });
    logs = await recordProcessEvent(input, logs, {
      stage: "compare-contract-wasm",
      level: equal ? "info" : "warning",
      code: equal ? "BLDV_WASM_VERIFIED" : "BLDV_WASM_MISMATCH",
      message: equal
        ? "Rebuilt and target Wasm bytes are exactly equal."
        : "Rebuilt and target Wasm bytes differ.",
      data: {
        targetLength: input.state.value.target.wasm.length,
        rebuiltLength: input.state.value.artifact.bytes.length,
      },
    });
    const finalEvidence = finalizeVerificationEvidence(evidence, logs);
    return equal
      ? { status: "verified", evidence: finalEvidence }
      : { status: "mismatch", evidence: finalEvidence };
  } catch (error) {
    throw contextualizeProcessError(
      error,
      new CompareContractWasmUnexpectedError(error),
      {
        input: redactContractBuildVerificationInput(input.state.value.request),
        evidence,
        logs,
      },
    );
  }
};

/** Error constructors emitted by {@link compareContractWasm}. */
export * from "./error.ts";
/** Process contracts used by {@link compareContractWasm}. */
export * from "./types.ts";
