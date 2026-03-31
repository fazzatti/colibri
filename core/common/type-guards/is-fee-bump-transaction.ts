import { FeeBumpTransaction, type Transaction } from "stellar-sdk";

/** Returns `true` when the provided transaction is a fee-bump envelope. */
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
