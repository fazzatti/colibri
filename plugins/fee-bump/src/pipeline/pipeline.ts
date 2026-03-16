import { pipe, step } from "convee";
import {
  ColibriError,
  assertRequiredArgs,
  steps,
} from "@colibri/core";
import {
  type CreateFeeBumpPipelineArgs,
  PIPELINE_NAME,
} from "@/pipeline/types.ts";
import {
  envSignReqToSignEnvelope,
  inputToBuild,
  wrapFeeBumpToEnvelopeSigningRequirements,
} from "@/pipeline/connectors.ts";
import * as E from "@/error.ts";

const createFeeBumpPipeline = ({
  networkConfig,
  feeBumpConfig,
}: CreateFeeBumpPipelineArgs) => {
  try {
    assertRequiredArgs(
      {
        networkConfig,
        networkPassphrase: networkConfig && networkConfig.networkPassphrase,
        feeBumpConfig,
      },
      (argName: string) => new E.MISSING_ARG(argName)
    );

    const inputStep = inputToBuild(
      networkConfig.networkPassphrase,
      feeBumpConfig
    );

    const WrapFeeBump = steps.createWrapFeeBumpStep();
    const EnvelopeSigningRequirements =
      steps.createEnvelopeSigningRequirementsStep();
    const SignEnvelope = steps.createSignEnvelopeStep();

    const pipelineSteps = [
      step(inputStep, { id: "fee-bump-input" as const }),
      WrapFeeBump,
      wrapFeeBumpToEnvelopeSigningRequirements,
      EnvelopeSigningRequirements,
      envSignReqToSignEnvelope(feeBumpConfig),
      SignEnvelope,
    ] as const;

    const feeBumpPipe = pipe([...pipelineSteps], {
      id: PIPELINE_NAME,
    });

    return feeBumpPipe;
  } catch (error) {
    if (error instanceof ColibriError) {
      throw error;
    }
    throw new E.UNEXPECTED_ERROR(error as Error);
  }
};

export { createFeeBumpPipeline };

const PIPE_FeeBump = {
  create: createFeeBumpPipeline,
  name: PIPELINE_NAME,
  errors: E,
};

export { PIPE_FeeBump };
