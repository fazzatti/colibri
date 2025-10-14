import { Pipeline, PipelineConnectors } from "convee";
import { type CreateFeeBumpPipelineArgs, PIPELINE_NAME } from "./types.ts";
import {
  ColibriError,
  P_EnvelopeSigningRequirements,
  P_SignEnvelope,
  P_WrapFeeBump,
  assertRequiredArgs,
} from "@colibri/core";
import {
  envSignReqToSignEnvelope,
  inputToBuild,
  wrapFeeBumpToEnvelopeSigningRequirements,
} from "../pipeline/connectors.ts";
import * as E from "../error.ts";

const { storeMetadata } = PipelineConnectors;
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

    const WrapFeeBump = P_WrapFeeBump();
    const EnvelopeSigningRequirements = P_EnvelopeSigningRequirements();
    const SignEnvelope = P_SignEnvelope();

    const pipelineSteps = [
      inputStep,
      WrapFeeBump,
      storeMetadata("wrapFeeBumpOutput", WrapFeeBump),
      wrapFeeBumpToEnvelopeSigningRequirements,
      EnvelopeSigningRequirements,
      envSignReqToSignEnvelope("wrapFeeBumpOutput", feeBumpConfig),
      SignEnvelope,
    ] as const;

    const pipe = Pipeline.create([...pipelineSteps], {
      name: PIPELINE_NAME,
    });

    return pipe;
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
