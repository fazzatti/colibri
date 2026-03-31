import type { SorobanDataBuilder, Transaction, xdr } from "stellar-sdk";

/** @internal */
export type AssembleTransactionInput = {
  transaction: Transaction;
  authEntries?: xdr.SorobanAuthorizationEntry[];
  sorobanData?: SorobanDataBuilder;
  resourceFee: number;
};

/** @internal */
export type AssembleTransactionOutput = Transaction;
