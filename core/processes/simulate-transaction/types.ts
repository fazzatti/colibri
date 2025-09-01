import type { Transaction } from "stellar-sdk";
import type { Server } from "stellar-sdk/rpc";

export type SimulateTransactionInput = {
  transaction: Transaction;
  rpc: Server;
};

export type SimulateTransactionOutput = {};
