import type { FeeBumpTransaction, Transaction } from "stellar-sdk";
import { isTransaction } from "./is-transaction.ts";
import { getOperationsFromTransaction } from "../helpers/transaction.ts";
import { isFeeBumpTransaction } from "./is-fee-bump-transaction.ts";

export const SMART_CONTRACT_OPERATIONS = [
  "invokeHostFunction",
  "extendFootprintTtl",
  "restoreFootprint",
];

export const isSmartContractTransaction = (
  transaction: Transaction | FeeBumpTransaction,
  softCheckFeebump: boolean = false // when true, it will allow feebump transactions and check their inner transaction
): transaction is Transaction => {
  if (!softCheckFeebump && isFeeBumpTransaction(transaction)) return false;

  const tx = isFeeBumpTransaction(transaction)
    ? transaction.innerTransaction
    : transaction;

  if (!isTransaction(tx)) return false;

  const ops = getOperationsFromTransaction(tx);

  if (ops.length === 0 || ops.length > 1) return false;

  const firstOp = ops[0];

  return SMART_CONTRACT_OPERATIONS.includes(firstOp.body().switch().name);
};
