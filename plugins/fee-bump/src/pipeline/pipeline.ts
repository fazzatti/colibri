import { pipe, step } from "convee";
import { assertRequiredArgs, ColibriError, steps } from "@colibri/core";
import {
  type CreateFeeBumpPipelineArgs,
  FEE_BUMP_PIPELINE_ID,
} from "@/pipeline/types.ts";
import {
  envSignReqToSignEnvelope,
  inputToBuild,
  wrapFeeBumpToEnvelopeSigningRequirements,
} from "@/pipeline/connectors.ts";
import * as E from "@/error.ts";

/**
 * Creates the internal pipeline used to wrap and sign fee-bump transactions.
 *
 * @param args - Pipeline construction arguments.
 * @returns A configured fee-bump pipeline.
 * @throws {E.MISSING_ARG} If a required argument is missing.
 * @throws {E.UNEXPECTED_ERROR} If pipeline creation fails unexpectedly.
 */
const createFeeBumpPipeline = ({
  networkConfig,
  feeBumpConfig,
}: CreateFeeBumpPipelineArgs): ReturnType<typeof pipe> => {
  try {
    assertRequiredArgs(
      {
        networkConfig,
        networkPassphrase: networkConfig && networkConfig.networkPassphrase,
        feeBumpConfig,
      },
      (argName: string) => new E.MISSING_ARG(argName),
    );

    const inputStep = inputToBuild(
      networkConfig.networkPassphrase,
      feeBumpConfig,
    );

    const WrapFeeBump = steps.createWrapFeeBumpStep();
    const EnvelopeSigningRequirements = steps
      .createEnvelopeSigningRequirementsStep();
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
      id: FEE_BUMP_PIPELINE_ID,
    });

    return feeBumpPipe;
  } catch (error) {
    if (error instanceof ColibriError) {
      throw error;
    }
    throw new E.UNEXPECTED_ERROR(error as Error);
  }
};

/**
 * Internal runtime pipeline returned by {@link createFeeBumpPipeline}.
 */
export { createFeeBumpPipeline };

/**
 * Internal runtime pipeline returned by {@link createFeeBumpPipeline}.
 */
export type FeeBumpPipeline = ReturnType<typeof createFeeBumpPipeline>;
