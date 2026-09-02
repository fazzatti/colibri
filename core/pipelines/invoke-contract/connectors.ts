import { step, type StepThis } from "convee";
import { Operation } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import type { InvokeContractInput } from "@/pipelines/invoke-contract/types.ts";
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
import type { AssembleForEnforcementInput } from "@/processes/assemble-for-enforcement/types.ts";
import type { EnforceSimulationInput } from "@/processes/enforce-simulation/types.ts";
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
import { EXPECTED_INVOKE_HOST_FUNCTION_OPERATION } from "@/pipelines/invoke-contract/error.ts";

export const INVOKE_CONTRACT_INPUT_STEP_ID = "invoke-contract-input" as const;

export const inputToBuild = (rpc: Server, networkPassphrase: string) => {
  return createInputToBuild<InvokeContractInput>(
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
    const inputStep = getRequiredStepOutput<InvokeContractInput>(
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
    const inputStep = getRequiredStepOutput<InvokeContractInput>(
      this,
      INVOKE_CONTRACT_INPUT_STEP_ID,
    );
    const transactionFee = typeof inputStep.config.fee === "string"
      ? {}
      : { transactionFee: inputStep.config.fee };

    return {
      authEntries,
      transaction,
      sorobanData,
      ...transactionFee,
    };
  }, { id: "invoke-contract-sign-auth-to-assemble" as const });

export const signAuthEntriesToAssembleForEnforcement = () =>
  step(function (
    this: StepThis,
    ...signAuthEntriesOutput: SignAuthEntriesOutput
  ): AssembleForEnforcementInput {
    const transaction = getRequiredStepOutput<BuildTransactionOutput>(
      this,
      BUILD_TRANSACTION_STEP_ID,
    );
    const simulateOutput = getRequiredStepOutput<SimulateTransactionOutput>(
      this,
      SIMULATE_TRANSACTION_STEP_ID,
    );
    const operation = getOperationsFromTransaction(transaction)[0];
    const inputStep = getRequiredStepOutput<InvokeContractInput>(
      this,
      INVOKE_CONTRACT_INPUT_STEP_ID,
    );
    const transactionFee = typeof inputStep.config.fee === "string"
      ? {}
      : { transactionFee: inputStep.config.fee };
    const body = operation.body;
    if (body.type !== "invokeHostFunction") {
      throw new EXPECTED_INVOKE_HOST_FUNCTION_OPERATION();
    }
    const authorizedOperation = Operation.invokeHostFunction({
      func: body.invokeHostFunctionOp.hostFunction,
      auth: signAuthEntriesOutput,
    });

    return {
      authorizedOperation,
      transaction,
      sorobanData: simulateOutput.transactionData,
      ...transactionFee,
    };
  }, { id: "invoke-contract-sign-auth-to-assemble-for-enforcement" as const });

export const assembleForEnforcementToEnforceSimulation = (rpc: Server) =>
  step(function (
    this: StepThis,
    transaction: EnforceSimulationInput["transaction"],
  ): EnforceSimulationInput {
    const recordingSimulation = getRequiredStepOutput<
      SimulateTransactionOutput
    >(
      this,
      SIMULATE_TRANSACTION_STEP_ID,
    );

    return { transaction, recordingSimulation, rpc };
  }, { id: "invoke-contract-assemble-for-enforcement-to-simulate" as const });

export const enforceSimulationToAssemble = () =>
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
    const inputStep = getRequiredStepOutput<InvokeContractInput>(
      this,
      INVOKE_CONTRACT_INPUT_STEP_ID,
    );
    const transactionFee = typeof inputStep.config.fee === "string"
      ? {}
      : { transactionFee: inputStep.config.fee };

    return {
      authEntries,
      transaction,
      sorobanData: simulationOutput.transactionData,
      ...transactionFee,
    };
  }, { id: "invoke-contract-enforce-simulation-to-assemble" as const });

export const envSignReqToSignEnvelope = () =>
  createEnvSignReqToSignEnvelope<
    InvokeContractInput,
    AssembleTransactionOutput
  >({
    id: "invoke-contract-envelope-to-sign-envelope" as const,
    inputStepId: INVOKE_CONTRACT_INPUT_STEP_ID,
    transactionStepId: ASSEMBLE_TRANSACTION_STEP_ID,
  });

export { signEnvelopeToSendTransaction };
