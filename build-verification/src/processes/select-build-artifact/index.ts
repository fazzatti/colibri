import { selectBuildArtifactCandidate } from "@/artifacts/select.ts";
import { accumulateVerificationEvidence } from "@/core/evidence/accumulate.ts";
import { redactContractBuildVerificationInput } from "@/core/types/input.ts";
import {
  contextualizeProcessError,
  recordProcessEvent,
} from "@/processes/shared.ts";
import { SelectBuildArtifactUnexpectedError } from "@/processes/select-build-artifact/error.ts";
import type {
  SelectBuildArtifactInput,
  SelectBuildArtifactOutput,
} from "@/processes/select-build-artifact/types.ts";

/** Selects the exact rebuilt Wasm from bounded candidate records. */
export const selectBuildArtifact = async (
  input: SelectBuildArtifactInput,
): Promise<SelectBuildArtifactOutput> => {
  if (input.state.state === "complete") return input.state;
  let evidence = input.state.evidence;
  let logs = input.state.logs;
  try {
    const artifact = selectBuildArtifactCandidate(
      input.state.value.candidates,
      input.state.value.recipe,
    );
    evidence = accumulateVerificationEvidence(evidence, {
      artifact: {
        path: artifact.path,
        size: artifact.size,
        sha256: artifact.sha256,
      },
    });
    logs = await recordProcessEvent(input, logs, {
      stage: "select-build-artifact",
      level: "info",
      code: "BLDV_BUILD_ARTIFACT_SELECTED",
      message: "Selected one exact rebuilt Wasm from recipe expectations.",
      data: {
        path: artifact.path,
        size: artifact.size,
        sha256: artifact.sha256,
      },
    });
    return {
      state: "active",
      value: { ...input.state.value, artifact },
      evidence,
      logs,
    };
  } catch (error) {
    throw contextualizeProcessError(
      error,
      new SelectBuildArtifactUnexpectedError(error),
      {
        input: redactContractBuildVerificationInput(input.state.value.request),
        evidence,
        logs,
      },
    );
  }
};

/** Error constructors emitted by {@link selectBuildArtifact}. */
export * from "@/processes/select-build-artifact/error.ts";
/** Process contracts used by {@link selectBuildArtifact}. */
export * from "@/processes/select-build-artifact/types.ts";
