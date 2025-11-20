import type { xdr } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import type { NetworkConfig } from "@/network/index.ts";

export type ReadFromContractInput = {
  operations: xdr.Operation[];
};

export type ReadFromContractOutput = xdr.ScVal | undefined;

export type CreateReadFromContractPipelineArgs = {
  networkConfig: NetworkConfig;
  rpc?: Server;
};
