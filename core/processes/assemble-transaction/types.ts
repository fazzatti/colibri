import type { SorobanDataBuilder, Transaction, xdr } from "stellar-sdk";

export type AssembleTransactionInput = {
  sorobanData?: SorobanDataBuilder;
  transaction: Transaction;
  authEntries?: xdr.SorobanAuthorizationEntry[];
};

export type AssembleTransactionOutput = Transaction;
