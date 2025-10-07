import type { xdr } from "stellar-sdk";

export type ReadFromContractInput = {
  operations: xdr.Operation[];
};

export type ReadFromContractOutput = xdr.ScVal | undefined;
