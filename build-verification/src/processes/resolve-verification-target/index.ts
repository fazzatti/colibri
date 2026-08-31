import {
  accumulateVerificationEvidence,
  createVerificationEvidence,
} from "@/core/evidence/index.ts";
import { redactContractBuildVerificationInput } from "@/core/types/input.ts";
import { isContractBuildVerificationInput } from "@/core/recipe/validate.ts";
import { InvalidVerificationInputError } from "@/error/core.ts";
import type {
  ContractBuildVerificationEvidence,
  VerificationLogEvent,
} from "@/core/types/index.ts";
import {
  completeNotApplicable,
  contextualizeProcessError,
  processTimestamp,
  recordProcessEvent,
} from "@/processes/shared.ts";
import { ResolveVerificationTargetUnexpectedError } from "@/processes/resolve-verification-target/error.ts";
import type {
  ResolveVerificationTargetInput,
  ResolveVerificationTargetOutput,
} from "@/processes/resolve-verification-target/types.ts";

/** Resolves exact target Wasm or completes early for a Stellar Asset Contract. */
export const resolveVerificationTarget = async (
  input: ResolveVerificationTargetInput,
): Promise<ResolveVerificationTargetOutput> => {
  let evidence: ContractBuildVerificationEvidence | undefined;
  let logs: readonly VerificationLogEvent[] = [];
  let redactedInput: unknown = { request: "invalid" };
  try {
    if (!isContractBuildVerificationInput(input.request)) {
      throw new InvalidVerificationInputError();
    }
    redactedInput = redactContractBuildVerificationInput(input.request);
    const mode = input.request.mode ?? "strictSep58";
    evidence = createVerificationEvidence(mode, processTimestamp(input));
    if (input.networkEvidence) {
      evidence = accumulateVerificationEvidence(evidence, {
        network: input.networkEvidence,
      });
    }
    logs = await recordProcessEvent(input, logs, {
      stage: "resolve-verification-target",
      level: "info",
      code: "BLDV_TARGET_RESOLUTION_STARTED",
      message: "Resolving exact verification target bytes.",
    });
    const target = await input.resolver.resolve({
      target: input.request.target,
    });
    evidence = accumulateVerificationEvidence(evidence, {
      target: {
        kind: target.kind,
        label: target.label,
        contractId: target.contractId,
        wasmHash: target.applicability === "wasm" ? target.wasmHash : undefined,
        wasmLength: target.applicability === "wasm"
          ? target.wasm.length
          : undefined,
        lastModifiedLedgerSeq: target.lastModifiedLedgerSeq,
        observedAt: target.observedAt,
      },
    });
    logs = await recordProcessEvent(input, logs, {
      stage: "resolve-verification-target",
      level: "info",
      code: target.applicability === "wasm"
        ? "BLDV_TARGET_RESOLVED"
        : "BLDV_TARGET_IS_SAC",
      message: target.applicability === "wasm"
        ? "Resolved exact target Wasm and hash."
        : "Target executable is a Stellar Asset Contract.",
    });
    if (target.applicability === "stellarAssetContract") {
      return {
        state: "complete",
        result: completeNotApplicable(
          "stellarAssetContract",
          evidence,
          logs,
        ),
      };
    }
    return {
      state: "active",
      value: { request: input.request, mode, target },
      evidence,
      logs,
    };
  } catch (error) {
    throw contextualizeProcessError(
      error,
      new ResolveVerificationTargetUnexpectedError(error),
      { input: redactedInput, evidence, logs },
    );
  }
};

/** Error constructors emitted by {@link resolveVerificationTarget}. */
export * from "@/processes/resolve-verification-target/error.ts";
/** Process contracts used by {@link resolveVerificationTarget}. */
export * from "@/processes/resolve-verification-target/types.ts";
