import { Pipeline, PipelineConnectors } from "convee";
import { Server } from "stellar-sdk/rpc";
import { P_BuildTransaction } from "@/processes/build-transaction/index.ts";
import type {
  CreateClassicTransactionPipelineArgs,
  ClassicTransactionInput,
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
import { P_EnvelopeSigningRequirements } from "@/processes/index.ts";
import { buildToEnvelopeSigningRequirements } from "@/transformers/pipeline-connectors/build-to-envelope-signing-req.ts";
import { P_SignEnvelope } from "@/processes/sign-envelope/index.ts";
import { P_SendTransaction } from "@/processes/send-transaction/index.ts";
import { assert } from "@/common/assert/assert.ts";

const { storeMetadata } = PipelineConnectors;

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

    const inputStep = inputToBuild(rpc, networkConfig.networkPassphrase);
    const connectSignEnvelopeToSend = signEnvelopeToSendTransaction(rpc);

    const BuildTransaction = P_BuildTransaction();
    const EnvelopeSigningRequirements = P_EnvelopeSigningRequirements();
    const SignEnvelope = P_SignEnvelope();
    const SendTransaction = P_SendTransaction();

    const pipelineSteps = [
      storeMetadata<ClassicTransactionInput>("pipeInput"),
      inputStep,
      BuildTransaction,
      storeMetadata("buildTxOutput", BuildTransaction),
      buildToEnvelopeSigningRequirements,
      EnvelopeSigningRequirements,
      envSignReqToSignEnvelope("buildTxOutput", "pipeInput"),
      SignEnvelope,
      connectSignEnvelopeToSend,
      SendTransaction,
      sendTransactionToPipeOutput,
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

export { createClassicTransactionPipeline };

const PIPE_ClassicTransaction = {
  create: createClassicTransactionPipeline,
  name: PIPELINE_NAME,
  errors: E,
};

export { PIPE_ClassicTransaction };
