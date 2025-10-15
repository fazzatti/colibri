import type { xdr } from "stellar-sdk";

export type AuthEntryParams = {
  credentials: {
    address: string;
    nonce: string;
    signatureExpirationLedger: number;
    signature?: string;
  };
  rootInvocation: InvocationParams;
};

export type InvocationParams = {
  function: {
    contractAddress: string;
    functionName: string;
    args: FnArg[] | xdr.ScVal[];
  };
  subInvocations?: InvocationParams[];
};

export type FnArg = {
  value: unknown;
  type: string;
};
