import { step, type StepThis } from "convee";
import { Operation } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import type { InvokeContractPipelineInput } from "@/pipelines/invoke-contract/types.ts";
import type {
  BuildTransactionOutput,
} from "@/processes/build-transaction/types.ts";
import type { SimulateTransactionOutput } from "@/processes/simulate-transaction/types.ts";
import type {
  AssembleTransactionInput,
  AssembleTransactionOutput,
} from "@/processes/assemble-transaction/types.ts";
import type {
  SignAuthEntriesInput,
  SignAuthEntriesOutput,
} from "@/processes/sign-auth-entries/types.ts";
import type { PostAuthAssembleTransactionInput } from "@/processes/post-auth-assemble-transaction/types.ts";
import type { PostAuthEnforcedSimulationInput } from "@/processes/post-auth-enforced-simulation/types.ts";
import {
  ASSEMBLE_TRANSACTION_STEP_ID,
  BUILD_TRANSACTION_STEP_ID,
  SIGN_AUTH_ENTRIES_STEP_ID,
  SIMULATE_TRANSACTION_STEP_ID,
} from "@/steps/index.ts";
import { getOperationsFromTransaction } from "@/common/helpers/transaction.ts";
import {
  createEnvSignReqToSignEnvelope,
  createInputToBuild,
  getRequiredStepOutput,
  signEnvelopeToSendTransaction,
} from "@/pipelines/shared/connectors/index.ts";

export const INVOKE_CONTRACT_INPUT_STEP_ID = "invoke-contract-input" as const;

export const inputToBuild = (rpc: Server, networkPassphrase: string) => {
  return createInputToBuild<InvokeContractPipelineInput>(
    rpc,
    networkPassphrase,
  );
};

export const simulateToSignAuthEntries = (
  rpc: Server,
  networkPassphrase: string,
) =>
  step(function (
    this: StepThis,
    simulationResponse: SimulateTransactionOutput,
  ): SignAuthEntriesInput {
    const authEntries = simulationResponse.result?.auth || [];
    const inputStep = getRequiredStepOutput<InvokeContractPipelineInput>(
      this,
      INVOKE_CONTRACT_INPUT_STEP_ID,
    );
    const signers = inputStep.config.signers || [];

    return {
      auth: authEntries,
      signers,
      rpc,
      networkPassphrase,
    };
  }, { id: "invoke-contract-simulate-to-sign-auth" as const });

export const signAuthEntriesToAssemble = () =>
  step(function (
    this: StepThis,
    ...signAuthEntriesOutput: SignAuthEntriesOutput
  ): AssembleTransactionInput {
    const transaction = getRequiredStepOutput<BuildTransactionOutput>(
      this,
      BUILD_TRANSACTION_STEP_ID,
    );

    const simulateOutput = getRequiredStepOutput<SimulateTransactionOutput>(
      this,
      SIMULATE_TRANSACTION_STEP_ID,
    );

    const sorobanData = simulateOutput.transactionData;
    const authEntries = signAuthEntriesOutput;
    const resourceFee = parseInt(simulateOutput.minResourceFee);

    return {
      authEntries,
      transaction,
      sorobanData,
      resourceFee,
    };
  }, { id: "invoke-contract-sign-auth-to-assemble" as const });

export const signAuthEntriesToPostAuthAssemble = () =>
  step(function (
    this: StepThis,
    ...signAuthEntriesOutput: SignAuthEntriesOutput
  ): PostAuthAssembleTransactionInput {
    const transaction = getRequiredStepOutput<BuildTransactionOutput>(
      this,
      BUILD_TRANSACTION_STEP_ID,
    );
    const simulateOutput = getRequiredStepOutput<SimulateTransactionOutput>(
      this,
      SIMULATE_TRANSACTION_STEP_ID,
    );
    const operation = getOperationsFromTransaction(transaction)[0];
    const authorizedOperation = Operation.invokeHostFunction({
      func: operation.body().invokeHostFunctionOp().hostFunction(),
      auth: signAuthEntriesOutput,
    });

    return {
      authorizedOperation,
      transaction,
      sorobanData: simulateOutput.transactionData,
      resourceFee: parseInt(simulateOutput.minResourceFee),
    };
  }, { id: "invoke-contract-sign-auth-to-post-auth-assemble" as const });

export const postAuthAssembleToEnforcedSimulation = (rpc: Server) =>
  step(function (
    this: StepThis,
    transaction: PostAuthEnforcedSimulationInput["transaction"],
  ): PostAuthEnforcedSimulationInput {
    const recordingSimulation = getRequiredStepOutput<
      SimulateTransactionOutput
    >(
      this,
      SIMULATE_TRANSACTION_STEP_ID,
    );

    return { transaction, recordingSimulation, rpc };
  }, { id: "invoke-contract-post-auth-assemble-to-simulate" as const });

export const postAuthEnforcedSimulationToAssemble = () =>
  step(function (
    this: StepThis,
    simulationOutput: SimulateTransactionOutput,
  ): AssembleTransactionInput {
    const transaction = getRequiredStepOutput<BuildTransactionOutput>(
      this,
      BUILD_TRANSACTION_STEP_ID,
    );
    const authEntries = getRequiredStepOutput<SignAuthEntriesOutput>(
      this,
      SIGN_AUTH_ENTRIES_STEP_ID,
    );

    return {
      authEntries,
      transaction,
      sorobanData: simulationOutput.transactionData,
      resourceFee: parseInt(simulationOutput.minResourceFee),
    };
  }, { id: "invoke-contract-post-auth-simulate-to-assemble" as const });

export const envSignReqToSignEnvelope = () =>
  createEnvSignReqToSignEnvelope<
    InvokeContractPipelineInput,
    AssembleTransactionOutput
  >({
    id: "invoke-contract-envelope-to-sign-envelope" as const,
    inputStepId: INVOKE_CONTRACT_INPUT_STEP_ID,
    transactionStepId: ASSEMBLE_TRANSACTION_STEP_ID,
  });

export { signEnvelopeToSendTransaction };
