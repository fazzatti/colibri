import { type FeeBumpTransaction, Transaction } from "stellar-sdk";

export const isTransaction = (
  tx: Transaction | FeeBumpTransaction
): tx is Transaction => {
  return (
    typeof tx === "object" &&
    tx !== null &&
    !(tx as FeeBumpTransaction).innerTransaction &&
    tx instanceof Transaction &&
    "source" in tx
  );
};
