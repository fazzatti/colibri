import type { Transaction } from "stellar-sdk";
import type { Api, Server } from "stellar-sdk/rpc";

/** @internal */
export type SimulateTransactionInput = {
  transaction: Transaction;
  rpc: Server;
};

/** @internal */
export type SimulateTransactionOutput =
  | Api.SimulateTransactionRestoreResponse
  | Api.SimulateTransactionSuccessResponse;
