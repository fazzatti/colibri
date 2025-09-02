import type { Transaction } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";

export type AssembleTransactionInput = {
  simulationResponse: Api.SimulateTransactionSuccessResponse;
  transaction: Transaction;
};

export type AssembleTransactionOutput = Transaction;
