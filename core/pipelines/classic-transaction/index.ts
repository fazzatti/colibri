import { Pipeline, PipelineConnectors } from "convee";
import { BuildTransaction } from "../../processes/build-transaction/index.ts";
import type {
  CreateClassicTransactionPipelineArgs,
  ClassicTransactionInput,
} from "./types.ts";
import * as E from "./error.ts";
import { Server } from "stellar-sdk/rpc";
import { ColibriError } from "../../error/index.ts";
import { assertRequiredArgs } from "../../common/assert/assert-args.ts";
import {
  envSignReqToSignEnvelope,
  inputToBuild,
  sendTransactionToPipeOutput,
  signEnvelopeToSendTransaction,
} from "./connectors.ts";
import { EnvelopeSigningRequirements } from "../../processes/index.ts";
import { buildToEnvelopeSigningRequirements } from "../../transformers/pipeline-connectors/build-to-envelope-signing-req.ts";
import { SignEnvelope } from "../../processes/sign-envelope/index.ts";
import { SendTransaction } from "../../processes/send-transaction/index.ts";

const { storeMetadata } = PipelineConnectors;

const createClassicTransactionPipeline = ({
  networkConfig,
}: CreateClassicTransactionPipelineArgs) => {
  try {
    assertRequiredArgs(
      {
        networkConfig,
        networkPassphrase: networkConfig && networkConfig.networkPassphrase,
        rpcUrl: networkConfig && networkConfig.rpcUrl,
      },
      (argName: string) => new E.MISSING_ARG(argName)
    );

    const rpc = new Server(networkConfig.rpcUrl!); // already asserted above

    const inputStep = inputToBuild(rpc, networkConfig.networkPassphrase);

    const connectSignEnvelopeToSend = signEnvelopeToSendTransaction(rpc);

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
      name: "ClassicTransactionPipeline",
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
