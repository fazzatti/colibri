import type { xdr } from "stellar-sdk";
import type { NetworkConfig } from "../../network/index.ts";

export type ReadFromContractInput = {
  operations: xdr.Operation[];
};

export type ReadFromContractOutput = xdr.ScVal | undefined;

export type CreateReadFromContractPipelineArgs = {
  networkConfig: NetworkConfig;
  // options? : PipelineOptions<TransactionInput,>
};
