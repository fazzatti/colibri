import type { xdr } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";
import type { NetworkConfig } from "@/network/index.ts";

/** @internal */
export type ReadFromContractInput = {
  operations: xdr.Operation[];
};

/** @internal */
export type ReadFromContractOutput = xdr.ScVal | undefined;

/** @internal */
export type CreateReadFromContractPipelineArgs = {
  networkConfig: NetworkConfig;
  rpc?: Server;
};
