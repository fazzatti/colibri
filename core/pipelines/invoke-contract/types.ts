import type { xdr } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import type {
  SorobanTransactionConfig,
  TransactionConfig,
} from "@/common/types/transaction-config/types.ts";
import type { NetworkConfig } from "@/network/index.ts";
import type { SendTransactionOutput } from "@/processes/send-transaction/types.ts";

/** @internal */
export type CreateInvokeContractPipelineArgs = {
  networkConfig: NetworkConfig;
  rpc?: Server;
};

/** @internal */
export type InvokeContractInput<
  TConfig extends SorobanTransactionConfig = TransactionConfig,
> = {
  operations: xdr.Operation[];
  config: TConfig;
};

/** @internal */
export type InvokeContractPipelineInput = InvokeContractInput<
  SorobanTransactionConfig
>;

/** @internal */
export type InvokeContractOutput = SendTransactionOutput;
