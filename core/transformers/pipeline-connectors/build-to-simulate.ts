import type { Server } from "stellar-sdk/rpc";
import type { BuildTransactionOutput } from "../../processes/build-transaction/types.ts";
import type { SimulateTransactionInput } from "../../processes/simulate-transaction/types.ts";
import type { Transformer } from "convee";

export const buildToSimulate = (
  rpc: Server
): Transformer<BuildTransactionOutput, SimulateTransactionInput> => {
  return (transaction: BuildTransactionOutput): SimulateTransactionInput => {
    return { transaction, rpc };
  };
};
