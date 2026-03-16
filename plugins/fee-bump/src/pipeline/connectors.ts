import { step, type StepThis } from "convee";
import type {
  FeeBumpConfig,
  WrapFeeBumpInput,
  WrapFeeBumpOutput,
  EnvelopeSigningRequirementsInput,
  EnvelopeSigningRequirementsOutput,
  SignEnvelopeInput,
} from "@colibri/core";
import type { FeeBumpPipelineInput } from "@/pipeline/types.ts";
import { ColibriError, steps } from "@colibri/core";

const getRequiredStepOutput = <Output>(
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

export const inputToBuild = (
  networkPassphrase: string,
  config: FeeBumpConfig,
) => {
  return (input: FeeBumpPipelineInput): WrapFeeBumpInput => {
    const { transaction } = input;
    return { transaction, config, networkPassphrase };
  };
};

export const wrapFeeBumpToEnvelopeSigningRequirements = (
  transaction: WrapFeeBumpOutput,
): EnvelopeSigningRequirementsInput => {
  return { transaction };
};

export const envSignReqToSignEnvelope = (
  config: FeeBumpConfig,
) =>
  step(function (
    this: StepThis,
    ...envelopeSigningRequirementsOutput: EnvelopeSigningRequirementsOutput
  ): SignEnvelopeInput {
    const signers = config.signers;

    const transaction = getRequiredStepOutput<WrapFeeBumpOutput>(
      this,
      steps.WRAP_FEE_BUMP_STEP_ID,
    );

    const signatureRequirements = envelopeSigningRequirementsOutput;

    return {
      signatureRequirements,
      transaction,
      signers,
    };
  }, { id: "fee-bump-envelope-to-sign-envelope" as const });
