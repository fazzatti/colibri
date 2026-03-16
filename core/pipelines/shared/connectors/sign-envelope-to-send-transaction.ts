import type { Server } from "stellar-sdk/rpc";
import type { SendTransactionInput } from "@/processes/send-transaction/types.ts";
import type { SignEnvelopeOutput } from "@/processes/sign-envelope/types.ts";

export const signEnvelopeToSendTransaction = (
  rpc: Server,
): ((transaction: SignEnvelopeOutput) => SendTransactionInput) => {
  return (transaction: SignEnvelopeOutput) => {
    return { transaction, rpc };
  };
};
