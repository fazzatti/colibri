import type { StepThis } from "convee";
import { PipelineStepOutputMissingError } from "./error.ts";

/** Reads one required preceding step output from the active Convee context. */
export const getRequiredBuildVerificationStepOutput = <Output>(
  runtime: StepThis,
  stepId: string,
): Output => {
  const snapshot = runtime.context().step.get(stepId);
  if (!snapshot || snapshot.output === undefined) {
    throw new PipelineStepOutputMissingError(stepId);
  }
  return snapshot.output as Output;
};
