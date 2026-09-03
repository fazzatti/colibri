import { type Pipe, pipe, type PipeContext, type Step, step } from "convee";
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
  assembleForEnforcementToEnforceSimulation,
  enforceSimulationToAssemble,
  envSignReqToSignEnvelope,
  inputToBuild,
  signAuthEntriesToAssembleForEnforcement,
  signEnvelopeToSendTransaction,
  simulateToSignAuthEntries,
} from "@/pipelines/invoke-contract/connectors.ts";
import { assembleToEnvelopeSigningRequirements } from "@/pipelines/shared/connectors/assemble-to-envelope-signing-req.ts";
import { assert } from "@/common/assert/assert.ts";
import {
  createAssembleForEnforcementStep,
  createAssembleTransactionStep,
  createBuildTransactionStep,
  createEnforceSimulationStep,
  createEnvelopeSigningRequirementsStep,
  createSendTransactionStep,
  createSignAuthEntriesStep,
  createSignEnvelopeStep,
  createSimulateTransactionStep,
} from "@/steps/index.ts";
import { INVOKE_CONTRACT_INPUT_STEP_ID } from "@/pipelines/invoke-contract/connectors.ts";
import type {
  BuildTransactionInput,
  BuildTransactionOutput,
} from "@/processes/build-transaction/types.ts";
import type {
  SimulateTransactionInput,
  SimulateTransactionOutput,
} from "@/processes/simulate-transaction/types.ts";
import type {
  SignAuthEntriesInput,
  SignAuthEntriesOutput,
} from "@/processes/sign-auth-entries/types.ts";
import type {
  AssembleForEnforcementInput,
  AssembleForEnforcementOutput,
} from "@/processes/assemble-for-enforcement/types.ts";
import type { EnforceSimulationInput } from "@/processes/enforce-simulation/types.ts";
import type {
  AssembleTransactionInput,
  AssembleTransactionOutput,
} from "@/processes/assemble-transaction/types.ts";
import type {
  EnvelopeSigningRequirementsInput,
  EnvelopeSigningRequirementsOutput,
} from "@/processes/envelope-signing-requirements/types.ts";
import type {
  SignEnvelopeInput,
  SignEnvelopeOutput,
} from "@/processes/sign-envelope/types.ts";
import type { SendTransactionInput } from "@/processes/send-transaction/types.ts";

/** Stable id of the invoke-contract pipeline. */
export const INVOKE_CONTRACT_PIPELINE_ID = "InvokeContractPipeline";

type InvokeContractPipelineSteps = readonly [
  Step<
    InvokeContractInput,
    InvokeContractInput,
    Error,
    typeof INVOKE_CONTRACT_INPUT_STEP_ID
  >,
  Step<
    InvokeContractInput,
    BuildTransactionInput,
    Error,
    "invoke-contract-build-input"
  >,
  ReturnType<typeof createBuildTransactionStep>,
  Step<BuildTransactionOutput, SimulateTransactionInput>,
  ReturnType<typeof createSimulateTransactionStep>,
  Step<
    SimulateTransactionOutput,
    SignAuthEntriesInput,
    Error,
    "invoke-contract-simulate-to-sign-auth"
  >,
  ReturnType<typeof createSignAuthEntriesStep>,
  Step<
    SignAuthEntriesOutput,
    AssembleForEnforcementInput,
    Error,
    "invoke-contract-sign-auth-to-assemble-for-enforcement"
  >,
  ReturnType<typeof createAssembleForEnforcementStep>,
  Step<
    AssembleForEnforcementOutput,
    EnforceSimulationInput,
    Error,
    "invoke-contract-assemble-for-enforcement-to-simulate"
  >,
  ReturnType<typeof createEnforceSimulationStep>,
  Step<
    SimulateTransactionOutput,
    AssembleTransactionInput,
    Error,
    "invoke-contract-enforce-simulation-to-assemble"
  >,
  ReturnType<typeof createAssembleTransactionStep>,
  Step<AssembleTransactionOutput, EnvelopeSigningRequirementsInput>,
  ReturnType<typeof createEnvelopeSigningRequirementsStep>,
  Step<EnvelopeSigningRequirementsOutput, SignEnvelopeInput>,
  ReturnType<typeof createSignEnvelopeStep>,
  Step<SignEnvelopeOutput, SendTransactionInput>,
  ReturnType<typeof createSendTransactionStep>,
];

type InvokeContractPipelineRuntime = Pipe<
  InvokeContractPipelineSteps,
  Error,
  PipeContext<InvokeContractPipelineSteps>,
  typeof INVOKE_CONTRACT_PIPELINE_ID
>;

/**
 * Builds the invoke-contract pipeline with fully inferred step types.
 */
const buildInvokeContractPipeline = ({
  networkConfig,
  rpc,
}: CreateInvokeContractPipelineArgs & {
  rpc: Server;
}): InvokeContractPipelineRuntime => {
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
  const AssembleForEnforcement = createAssembleForEnforcementStep();
  const EnforceSimulation = createEnforceSimulationStep();
  const AssembleTransaction = createAssembleTransactionStep();
  const EnvelopeSigningRequirements = createEnvelopeSigningRequirementsStep();
  const SignEnvelope = createSignEnvelopeStep();
  const SendTransaction = createSendTransactionStep();

  const pipelineSteps: InvokeContractPipelineSteps = [
    inputStep,
    buildInputStep,
    BuildTransaction,
    step(connectBuildToSimulate),
    SimulateTransaction,
    connectSimulateToSignAuthEntries,
    SignAuthEntries,
    signAuthEntriesToAssembleForEnforcement(),
    AssembleForEnforcement,
    assembleForEnforcementToEnforceSimulation(rpc),
    EnforceSimulation,
    enforceSimulationToAssemble(),
    AssembleTransaction,
    step(assembleToEnvelopeSigningRequirements),
    EnvelopeSigningRequirements,
    envSignReqToSignEnvelope(),
    SignEnvelope,
    step(connectSignEnvelopeToSend),
    SendTransaction,
  ];

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
