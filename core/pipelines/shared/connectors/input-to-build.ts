import type { Server } from "stellar-sdk/rpc";
import type { xdr } from "stellar-sdk";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { BuildTransactionInput } from "@/processes/build-transaction/types.ts";

type InputWithTransactionConfig = {
  operations: xdr.Operation[];
  config: Pick<TransactionConfig, "extraSigners" | "fee" | "source">;
};

export const createInputToBuild = <Input extends InputWithTransactionConfig>(
  rpc: Server,
  networkPassphrase: string,
) => {
  return (input: Input): BuildTransactionInput => {
    const { operations, config } = input;

    const fee = typeof config.fee === "string"
      ? { baseFee: config.fee }
      : { transactionFee: config.fee };

    return {
      ...fee,
      source: config.source,
      networkPassphrase,
      operations,
      rpc,
      preconditions: config.extraSigners?.length
        ? { extraSigners: config.extraSigners }
        : undefined,
    };
  };
};
