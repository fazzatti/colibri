import type { SorobanDataBuilder, Transaction, xdr } from "stellar-sdk";

/** @internal */
export type PostAuthAssembleTransactionInput = {
  transaction: Transaction;
  authorizedOperation: xdr.Operation;
  sorobanData?: SorobanDataBuilder;
  resourceFee: number;
};

/** @internal */
export type PostAuthAssembleTransactionOutput = Transaction;
