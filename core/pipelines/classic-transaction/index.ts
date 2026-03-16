import { pipe, step } from "convee";
import { Server } from "stellar-sdk/rpc";
import type {
  ClassicTransactionInput,
  CreateClassicTransactionPipelineArgs,
} from "@/pipelines/classic-transaction/types.ts";
import * as E from "@/pipelines/classic-transaction/error.ts";
import { ColibriError } from "@/error/index.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import {
  envSignReqToSignEnvelope,
  inputToBuild,
  sendTransactionToPipeOutput,
  signEnvelopeToSendTransaction,
} from "@/pipelines/classic-transaction/connectors.ts";
import { buildToEnvelopeSigningRequirements } from "@/pipelines/shared/connectors/build-to-envelope-signing-req.ts";
import { assert } from "@/common/assert/assert.ts";
import {
  createBuildTransactionStep,
  createEnvelopeSigningRequirementsStep,
  createSendTransactionStep,
  createSignEnvelopeStep,
} from "@/steps/index.ts";
import { CLASSIC_TRANSACTION_INPUT_STEP_ID } from "@/pipelines/classic-transaction/connectors.ts";

const PIPELINE_NAME = "ClassicTransactionPipeline";

const createClassicTransactionPipeline = ({
  networkConfig,
  rpc,
}: CreateClassicTransactionPipelineArgs) => {
  try {
    assertRequiredArgs(
      {
        networkConfig,
        networkPassphrase: networkConfig && networkConfig.networkPassphrase,
      },
      (argName: string) => new E.MISSING_ARG(argName)
    );

    if (!rpc) {
      assert(networkConfig && networkConfig.rpcUrl, new E.MISSING_RPC_URL());
      rpc = new Server(networkConfig.rpcUrl!);
    }

    const inputStep = step(
      (input: ClassicTransactionInput) => input,
      { id: CLASSIC_TRANSACTION_INPUT_STEP_ID },
    );
    const buildInputStep = step(
      inputToBuild(rpc, networkConfig.networkPassphrase),
      { id: "classic-transaction-build-input" as const },
    );
    const connectSignEnvelopeToSend = signEnvelopeToSendTransaction(rpc);

    const BuildTransaction = createBuildTransactionStep();
    const EnvelopeSigningRequirements = createEnvelopeSigningRequirementsStep();
    const SignEnvelope = createSignEnvelopeStep();
    const SendTransaction = createSendTransactionStep();

    const pipelineSteps = [
      inputStep,
      buildInputStep,
      BuildTransaction,
      buildToEnvelopeSigningRequirements,
      EnvelopeSigningRequirements,
      envSignReqToSignEnvelope(),
      SignEnvelope,
      connectSignEnvelopeToSend,
      SendTransaction,
      sendTransactionToPipeOutput,
    ] as const;

    const classicPipe = pipe([...pipelineSteps], {
      id: PIPELINE_NAME,
    });

    return classicPipe;
  } catch (error) {
    if (error instanceof ColibriError) {
      throw error;
    }
    throw new E.UNEXPECTED_ERROR(error as Error);
  }
};

export { createClassicTransactionPipeline };

const PIPE_ClassicTransaction = {
  create: createClassicTransactionPipeline,
  name: PIPELINE_NAME,
  errors: E,
};

export { PIPE_ClassicTransaction };
