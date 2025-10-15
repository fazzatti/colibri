import type { xdr } from "stellar-sdk";
import type { TransactionConfig } from "../../common/types/transaction-config/types.ts";
import type { NetworkConfig } from "../../network/index.ts";
import type { SendTransactionOutput } from "../../processes/send-transaction/types.ts";
import type { Server } from "stellar-sdk/rpc";

export type CreateClassicTransactionPipelineArgs = {
  networkConfig: NetworkConfig;
  rpc?: Server;
};

export type ClassicTransactionInput = {
  operations: xdr.Operation[];
  config: TransactionConfig;
};

export type ClassicTransactionOutput = {
  hash: SendTransactionOutput["hash"];
  response: SendTransactionOutput["response"];
};
