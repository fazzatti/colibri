import { FeeBumpTransaction, type Transaction } from "stellar-sdk";

export const isFeeBumpTransaction = (
  tx: Transaction | FeeBumpTransaction
): tx is FeeBumpTransaction => {
  return (
    typeof tx === "object" &&
    tx !== null &&
    tx instanceof FeeBumpTransaction &&
    tx.innerTransaction &&
    "feeSource" in tx
  );
};
