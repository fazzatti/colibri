import { pipe, step } from "convee";
import { Server } from "stellar-sdk/rpc";
import type {
  CreateInvokeContractPipelineArgs,
  InvokeContractInput,
} from "@/pipelines/invoke-contract/types.ts";
import * as E from "@/pipelines/invoke-contract/error.ts";
import { ColibriError } from "@/error/index.ts";
import { buildToSimulate } from "@/pipelines/shared/connectors/build-to-simulate.ts";
import { assertRequiredArgs } from "@/common/assert/assert-args.ts";
import {
  envSignReqToSignEnvelope,
  inputToBuild,
  signAuthEntriesToAssemble,
  signEnvelopeToSendTransaction,
  simulateToSignAuthEntries,
} from "@/pipelines/invoke-contract/connectors.ts";
import { assembleToEnvelopeSigningRequirements } from "@/pipelines/shared/connectors/assemble-to-envelope-signing-req.ts";
import { assert } from "@/common/assert/assert.ts";
import {
  createAssembleTransactionStep,
  createBuildTransactionStep,
  createEnvelopeSigningRequirementsStep,
  createSendTransactionStep,
  createSignAuthEntriesStep,
  createSignEnvelopeStep,
  createSimulateTransactionStep,
} from "@/steps/index.ts";
import { INVOKE_CONTRACT_INPUT_STEP_ID } from "@/pipelines/invoke-contract/connectors.ts";

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

    const inputStep = step(
      (input: InvokeContractInput) => input,
      { id: INVOKE_CONTRACT_INPUT_STEP_ID },
    );
    const buildInputStep = step(
      inputToBuild(rpc, networkConfig.networkPassphrase),
      { id: "invoke-contract-build-input" as const },
    );
    const connectBuildToSimulate = buildToSimulate(rpc);
    const connectSimulateToSignAuthEntries = simulateToSignAuthEntries(
      rpc,
      networkConfig.networkPassphrase,
    );
    const connectSignEnvelopeToSend = signEnvelopeToSendTransaction(rpc);

    const BuildTransaction = createBuildTransactionStep();
    const SimulateTransaction = createSimulateTransactionStep();
    const SignAuthEntries = createSignAuthEntriesStep();
    const AssembleTransaction = createAssembleTransactionStep();
    const EnvelopeSigningRequirements = createEnvelopeSigningRequirementsStep();
    const SignEnvelope = createSignEnvelopeStep();
    const SendTransaction = createSendTransactionStep();

    const pipelineSteps = [
      inputStep,
      buildInputStep,
      BuildTransaction,
      connectBuildToSimulate,
      SimulateTransaction,
      connectSimulateToSignAuthEntries,
      SignAuthEntries,
      signAuthEntriesToAssemble(),
      AssembleTransaction,
      assembleToEnvelopeSigningRequirements,
      EnvelopeSigningRequirements,
      envSignReqToSignEnvelope(),
      SignEnvelope,
      connectSignEnvelopeToSend,
      SendTransaction,
    ] as const;

    const invokePipe = pipe([...pipelineSteps], {
      id: PIPELINE_NAME,
    });

    return invokePipe;
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
