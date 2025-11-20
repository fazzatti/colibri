import type { xdr } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { NetworkConfig } from "@/network/index.ts";
import type { SendTransactionOutput } from "@/processes/send-transaction/types.ts";

export type CreateInvokeContractPipelineArgs = {
  networkConfig: NetworkConfig;
  rpc?: Server;
};

export type InvokeContractInput = {
  operations: xdr.Operation[];
  config: TransactionConfig;
};

export type InvokeContractOutput = SendTransactionOutput;
