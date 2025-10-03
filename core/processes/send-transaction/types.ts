import type { FeeBumpTransaction, Transaction, xdr } from "stellar-sdk";
import type { Api, Server } from "stellar-sdk/rpc";

export type SendTransactionInput = {
  tx: Transaction | FeeBumpTransaction;
  rpc: Server;
  options?: Partial<SendTransactionOptions>;
};

export type SendTransactionOptions = {
  timeoutInSeconds: number;
  waitIntervalInMs: number;
  useTransactionTimeoutIfAvailable: boolean;
};

export type SendTransactionOutput = {
  hash: string;
  returnValue: xdr.ScVal | undefined;
  response: Api.GetSuccessfulTransactionResponse;
};

export const DEFAULT_OPTIONS: SendTransactionOptions = {
  timeoutInSeconds: 45,
  waitIntervalInMs: 500,
  useTransactionTimeoutIfAvailable: true,
};

export enum SendTransactionStatus {
  PENDING = "PENDING",
  DUPLICATE = "DUPLICATE",
  TRY_AGAIN_LATER = "TRY_AGAIN_LATER",
  ERROR = "ERROR",
}
