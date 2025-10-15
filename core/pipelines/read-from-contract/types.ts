import type { xdr } from "stellar-sdk";
import type { NetworkConfig } from "../../network/index.ts";
import type { Server } from "stellar-sdk/rpc";

export type ReadFromContractInput = {
  operations: xdr.Operation[];
};

export type ReadFromContractOutput = xdr.ScVal | undefined;

export type CreateReadFromContractPipelineArgs = {
  networkConfig: NetworkConfig;
  rpc?: Server;
};
