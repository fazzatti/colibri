import type { Transaction } from "stellar-sdk";
import type { Api, Server } from "stellar-sdk/rpc";

export type SimulateTransactionInput = {
  transaction: Transaction;
  rpc: Server;
};

export type SimulateTransactionOutput =
  | Api.SimulateTransactionRestoreResponse
  | Api.SimulateTransactionSuccessResponse;
