import type { SorobanDataBuilder, Transaction, xdr } from "stellar-sdk";
import type { TransactionFee } from "@/common/types/transaction-config/types.ts";

/** @internal */
export type AssembleTransactionInput = {
  transaction: Transaction;
  authEntries?: xdr.SorobanAuthorizationEntry[];
  sorobanData?: SorobanDataBuilder;
  transactionFee?: TransactionFee;
  /** @deprecated Resource fees are read from `sorobanData`. */
  resourceFee?: number;
};

/** @internal */
export type AssembleTransactionOutput = Transaction;
