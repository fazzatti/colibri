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

/** Stable id of the invoke-contract pipeline. */
export const INVOKE_CONTRACT_PIPELINE_ID = "InvokeContractPipeline";

/**
 * Builds the invoke-contract pipeline with fully inferred step types.
 */
const buildInvokeContractPipeline = ({
  networkConfig,
  rpc,
}: CreateInvokeContractPipelineArgs & { rpc: Server }) => {
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

  return pipe([...pipelineSteps], {
    id: INVOKE_CONTRACT_PIPELINE_ID,
  });
};

/**
 * Creates the invoke-contract pipeline.
 *
 * @param args Pipeline dependencies and network configuration.
 * @returns Configured invoke-contract pipeline.
 */
const createInvokeContractPipeline = ({
  networkConfig,
  rpc,
}: CreateInvokeContractPipelineArgs): ReturnType<
  typeof buildInvokeContractPipeline
> => {
  try {
    assertRequiredArgs(
      {
        networkConfig,
        networkPassphrase: networkConfig && networkConfig.networkPassphrase,
      },
      (argName: string) => new E.MISSING_ARG(argName),
    );

    if (!rpc) {
      assert(networkConfig && networkConfig.rpcUrl, new E.MISSING_RPC_URL());
      rpc = new Server(networkConfig.rpcUrl!, {
        allowHttp: networkConfig.allowHttp ?? false,
      });
    }
    return buildInvokeContractPipeline({ networkConfig, rpc });
  } catch (error) {
    if (error instanceof ColibriError) {
      throw error;
    }
    throw new E.UNEXPECTED_ERROR(error as Error);
  }
};

export { createInvokeContractPipeline };
/** Runtime type returned by {@link createInvokeContractPipeline}. */
export type InvokeContractPipeline = ReturnType<
  typeof createInvokeContractPipeline
>;
export { ERROR_PIPE_INVC } from "@/pipelines/invoke-contract/error.ts";
