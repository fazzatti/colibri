import type { FeeBumpTransaction, Transaction, xdr } from "stellar-sdk";
import type { Api, Server } from "stellar-sdk/rpc";

/**
 * RPC server type accepted by Colibri transaction submission helpers.
 */
/** @internal */
export type RpcServer = Server;

/**
 * Successful transaction response returned by Stellar RPC.
 */
/** @internal */
export type RpcSuccessfulTransactionResponse =
  Api.GetSuccessfulTransactionResponse;

/**
 * Soroban return value extracted from a successful submitted transaction.
 */
/** @internal */
export type XdrScVal = xdr.ScVal;

/**
 * Transaction envelope accepted by the send-transaction process.
 */
/** @internal */
export type SendableTransaction = Transaction | FeeBumpTransaction;

/**
 * Input accepted by the send-transaction process.
 */
export type SendTransactionInput = {
  /** Signed Stellar transaction or fee-bump envelope to submit. */
  transaction: SendableTransaction;
  /** RPC server used to send and poll transaction status. */
  rpc: RpcServer;
  /** Optional submission overrides. */
  options?: Partial<SendTransactionOptions>;
};

/**
 * Polling options used while waiting for a transaction result.
 */
export type SendTransactionOptions = {
  /** Maximum time to wait for a terminal transaction status. */
  timeoutInSeconds: number;
  /** Poll interval used when checking transaction status. */
  waitIntervalInMs: number;
  /** Reuse the transaction timeout when available. */
  useTransactionTimeoutIfAvailable: boolean;
};

/**
 * Successful output returned by the send-transaction process.
 */
export type SendTransactionOutput = {
  /** Transaction hash returned by Stellar RPC. */
  hash: string;
  /** Soroban return value, when the submitted transaction produced one. */
  returnValue: XdrScVal | undefined;
  /** Ledger sequence in which the transaction was included. */
  ledger: number;
  /** Timestamp (in ms since epoch) when the transaction was included in the ledger. */
  createdAt: number;
  /** Full successful response returned by Stellar RPC. */
  response: RpcSuccessfulTransactionResponse;
};

/**
 * Default polling options used by the send-transaction process.
 */
export const DEFAULT_OPTIONS: SendTransactionOptions = {
  timeoutInSeconds: 45,
  waitIntervalInMs: 500,
  useTransactionTimeoutIfAvailable: true,
};

/**
 * Status values observed while polling transaction submission results.
 */
export enum SendTransactionStatus {
  PENDING = "PENDING",
  DUPLICATE = "DUPLICATE",
  TRY_AGAIN_LATER = "TRY_AGAIN_LATER",
  ERROR = "ERROR",
}
