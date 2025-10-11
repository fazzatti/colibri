import type { xdr } from "stellar-sdk";
import type { TransactionConfig } from "../../common/types/transaction-config/types.ts";
import type { NetworkConfig } from "../../network/index.ts";

export type CreateInvokeContractPipelineArgs = {
  networkConfig: NetworkConfig;
  // options? : PipelineOptions<TransactionInput,>
};

export type InvokeContractInput = {
  operations: xdr.Operation[];
  config: TransactionConfig;
};
