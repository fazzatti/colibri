import type { Server } from "stellar-sdk/rpc";
import type {
  ClassicTransactionInput,
  ClassicTransactionOutput,
} from "@/pipelines/classic-transaction/types.ts";
import type { BuildTransactionOutput } from "@/processes/build-transaction/types.ts";
import type {
  SendTransactionOutput,
} from "@/processes/send-transaction/types.ts";
import { BUILD_TRANSACTION_STEP_ID } from "@/steps/index.ts";
import {
  createEnvSignReqToSignEnvelope,
  createInputToBuild,
  signEnvelopeToSendTransaction,
} from "@/pipelines/shared/connectors/index.ts";

export const CLASSIC_TRANSACTION_INPUT_STEP_ID =
  "classic-transaction-input" as const;

export const inputToBuild = (rpc: Server, networkPassphrase: string) => {
  return createInputToBuild<ClassicTransactionInput>(rpc, networkPassphrase);
};

export const envSignReqToSignEnvelope = () =>
  createEnvSignReqToSignEnvelope<
    ClassicTransactionInput,
    BuildTransactionOutput
  >({
    id: "classic-transaction-sign-envelope-input" as const,
    inputStepId: CLASSIC_TRANSACTION_INPUT_STEP_ID,
    transactionStepId: BUILD_TRANSACTION_STEP_ID,
  });

export { signEnvelopeToSendTransaction };

export const sendTransactionToPipeOutput = (
  sendOutput: SendTransactionOutput,
): ClassicTransactionOutput => {
  return { hash: sendOutput.hash, response: sendOutput.response };
};
