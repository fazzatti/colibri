import { Pipeline, PipelineConnectors } from "convee";
import { Server } from "stellar-sdk/rpc";
import { P_BuildTransaction } from "@/processes/build-transaction/index.ts";
import { P_SimulateTransaction } from "@/processes/simulate-transaction/index.ts";
import type {
  CreateInvokeContractPipelineArgs,
  InvokeContractInput,
} from "@/pipelines/invoke-contract/types.ts";
import * as E from "@/pipelines/invoke-contract/error.ts";
import { ColibriError } from "@/error/index.ts";
import { buildToSimulate } from "@/transformers/pipeline-connectors/build-to-simulate.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import { P_AssembleTransaction } from "@/processes/assemble-transaction/index.ts";
import {
  envSignReqToSignEnvelope,
  inputToBuild,
  signAuthEntriesToAssemble,
  signEnvelopeToSendTransaction,
  simulateToSignAuthEntries,
} from "@/pipelines/invoke-contract/connectors.ts";
import { P_SignAuthEntries } from "@/processes/sign-auth-entries/index.ts";
import { P_EnvelopeSigningRequirements } from "@/processes/index.ts";
import { assembleToEnvelopeSigningRequirements } from "@/transformers/pipeline-connectors/assemble-to-envelope-signing-req.ts";
import { P_SignEnvelope } from "@/processes/sign-envelope/index.ts";
import { P_SendTransaction } from "@/processes/send-transaction/index.ts";
import { assert } from "@/common/assert/assert.ts";

const { storeMetadata } = PipelineConnectors;

export const PIPELINE_NAME = "InvokeContractPipeline";

const createInvokeContractPipeline = ({
  networkConfig,
  rpc,
}: CreateInvokeContractPipelineArgs) => {
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
    const connectBuildToSimulate = buildToSimulate(rpc);
    const connectSimulateToSignAuthEntries = simulateToSignAuthEntries(
      "pipeInput",
      rpc,
      networkConfig.networkPassphrase
    );
    const connectSignEnvelopeToSend = signEnvelopeToSendTransaction(rpc);

    const BuildTransaction = P_BuildTransaction();
    const SimulateTransaction = P_SimulateTransaction();
    const SignAuthEntries = P_SignAuthEntries();
    const AssembleTransaction = P_AssembleTransaction();
    const EnvelopeSigningRequirements = P_EnvelopeSigningRequirements();
    const SignEnvelope = P_SignEnvelope();
    const SendTransaction = P_SendTransaction();

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

export { createInvokeContractPipeline };

const PIPE_InvokeContract = {
  create: createInvokeContractPipeline,
  name: PIPELINE_NAME,
  errors: E,
};

export { PIPE_InvokeContract };
export type InvokeContractPipeline = ReturnType<
  typeof PIPE_InvokeContract.create
>;
