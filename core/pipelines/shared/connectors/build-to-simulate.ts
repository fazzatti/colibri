import type { Server } from "stellar-sdk/rpc";
import type { BuildTransactionOutput } from "@/processes/build-transaction/types.ts";
import type { SimulateTransactionInput } from "@/processes/simulate-transaction/types.ts";

export const buildToSimulate = (
  rpc: Server,
): ((transaction: BuildTransactionOutput) => SimulateTransactionInput) => {
  return (transaction: BuildTransactionOutput): SimulateTransactionInput => {
    return { transaction, rpc };
  };
};
