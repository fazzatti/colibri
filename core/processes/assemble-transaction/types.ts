import type { SorobanDataBuilder, Transaction, xdr } from "stellar-sdk";

export type AssembleTransactionInput = {
  transaction: Transaction;
  authEntries?: xdr.SorobanAuthorizationEntry[];
  sorobanData?: SorobanDataBuilder;
  resourceFee: number;
};

export type AssembleTransactionOutput = Transaction;
