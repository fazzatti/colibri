import { step, type StepThis } from "convee";
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
import {
  ASSEMBLE_TRANSACTION_STEP_ID,
  BUILD_TRANSACTION_STEP_ID,
  SIMULATE_TRANSACTION_STEP_ID,
} from "@/steps/index.ts";
import {
  createEnvSignReqToSignEnvelope,
  createInputToBuild,
  getRequiredStepOutput,
  signEnvelopeToSendTransaction,
} from "@/pipelines/shared/connectors/index.ts";

export const INVOKE_CONTRACT_INPUT_STEP_ID =
  "invoke-contract-input" as const;

export const inputToBuild = (rpc: Server, networkPassphrase: string) => {
  return createInputToBuild<InvokeContractInput>(rpc, networkPassphrase);
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
    const resourceFee = parseInt(simulateOutput.minResourceFee);

    return {
      authEntries,
      transaction,
      sorobanData,
      resourceFee,
    };
  }, { id: "invoke-contract-sign-auth-to-assemble" as const });

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
