import type { TransactionSigner } from "@/signer/types.ts";

export const isTransactionSigner = (
  signer: unknown
): signer is TransactionSigner => {
  if (typeof signer !== "object" || signer === null) {
    return false;
  }

  return (
    "publicKey" in signer &&
    typeof (signer as TransactionSigner).publicKey === "function" &&
    "sign" in signer &&
    typeof (signer as TransactionSigner).sign === "function" &&
    "signTransaction" in signer &&
    typeof (signer as TransactionSigner).signTransaction === "function" &&
    "signSorobanAuthEntry" in signer &&
    typeof (signer as TransactionSigner).signSorobanAuthEntry === "function"
  );
};
