import type { SorobanDataBuilder, Transaction, xdr } from "stellar-sdk";
import type { TransactionFee } from "@/common/types/transaction-config/types.ts";
import type { TransactionResources } from "@/common/types/transaction-config/resources.ts";

/** @internal */
export type AssembleTransactionInput = {
  transaction: Transaction;
  authEntries?: xdr.SorobanAuthorizationEntry[];
  sorobanData?: SorobanDataBuilder;
  transactionFee?: TransactionFee;
  /** Overrides the resource fee embedded in the provided Soroban data. */
  resourceFee?: string;
  /** Resource policy applied to final simulation data; cannot accompany the legacy resourceFee argument. */
  resources?: TransactionResources;
};

/** @internal */
export type AssembleTransactionOutput = Transaction;
