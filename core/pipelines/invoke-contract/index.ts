import { Pipeline, PipelineConnectors } from "convee";
import { BuildTransaction } from "../../processes/build-transaction/index.ts";
import { SimulateTransaction } from "../../processes/simulate-transaction/index.ts";
import type {
  CreateInvokeContractPipelineArgs,
  InvokeContractInput,
} from "./types.ts";
import * as E from "./error.ts";

import { Server } from "stellar-sdk/rpc";
import { ColibriError } from "../../error/index.ts";

import { buildToSimulate } from "../../transformers/pipeline-connectors/build-to-simulate.ts";
import { assertRequiredArgs } from "../../common/assert/assert-args.ts";
import { AssembleTransaction } from "../../processes/assemble-transaction/index.ts";
import {
  envSignReqToSignEnvelope,
  inputToBuild,
  signAuthEntriesToAssemble,
  signEnvelopeToSendTransaction,
  simulateToSignAuthEntries,
} from "./connectors.ts";
import { SignAuthEntries } from "../../processes/sign-auth-entries/index.ts";
import { EnvelopeSigningRequirements } from "../../processes/index.ts";
import { assembleToEnvelopeSigningRequirements } from "../../transformers/pipeline-connectors/assemble-to-envelope-signing-req";
import { SignEnvelope } from "../../processes/sign-envelope/index.ts";
import { SendTransaction } from "../../processes/send-transaction/index.ts";

const { storeMetadata } = PipelineConnectors;

const createInvokeContractPipeline = ({
  networkConfig,
}: CreateInvokeContractPipelineArgs) => {
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
    const connectBuildToSimulate = buildToSimulate(rpc);
    const connectSimulateToSignAuthEntries = simulateToSignAuthEntries(
      "pipeInput",
      rpc,
      networkConfig.networkPassphrase
    );
    const connectSignEnvelopeToSend = signEnvelopeToSendTransaction(rpc);

    const pipelineSteps = [
      storeMetadata<InvokeContractInput>("pipeInput"),
      inputStep,
      BuildTransaction,
      storeMetadata("buildTxOutput", BuildTransaction),
      connectBuildToSimulate,
      SimulateTransaction,
      storeMetadata("simulateTxOutput", SimulateTransaction),
      connectSimulateToSignAuthEntries,
      SignAuthEntries,
      signAuthEntriesToAssemble("buildTxOutput", "simulateTxOutput"),
      AssembleTransaction,
      storeMetadata("assembleTxOutput", AssembleTransaction),
      assembleToEnvelopeSigningRequirements,
      EnvelopeSigningRequirements,
      envSignReqToSignEnvelope("assembleTxOutput", "pipeInput"),
      SignEnvelope,
      connectSignEnvelopeToSend,
      SendTransaction,
    ] as const;

    const pipe = Pipeline.create([...pipelineSteps], {
      name: "InvokeContractPipeline",
    });

    return pipe;
  } catch (error) {
    if (error instanceof ColibriError) {
      throw error;
    }
    throw new E.UNEXPECTED_ERROR(error as Error);
  }
};

export { createInvokeContractPipeline };
