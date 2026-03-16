import type { StepThis } from "convee";
import { ColibriError } from "@/error/index.ts";

export const getRequiredStepOutput = <Output>(
  runtime: StepThis,
  stepId: string,
): Output => {
  const snapshot = runtime.context().step.get(stepId);

  if (!snapshot || snapshot.output === undefined) {
    throw ColibriError.unexpected({
      message: `Missing required step output: '${stepId}'`,
    });
  }

  return snapshot.output as Output;
};
