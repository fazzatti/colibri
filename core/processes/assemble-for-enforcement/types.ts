import type { SorobanDataBuilder, Transaction, xdr } from "stellar-sdk";
import type { TransactionFee } from "@/common/types/transaction-config/types.ts";

/** @internal */
export type AssembleForEnforcementInput = {
  transaction: Transaction;
  authorizedOperation: xdr.Operation;
  sorobanData?: SorobanDataBuilder;
  transactionFee?: TransactionFee;
  /** Overrides the resource fee embedded in the provided Soroban data. */
  resourceFee?: string;
};

/** @internal */
export type AssembleForEnforcementOutput = Transaction;
