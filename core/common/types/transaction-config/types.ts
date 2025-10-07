import type { Ed25519PublicKey, TransactionSigner } from "../../types.ts";

export type TransactionConfig = {
  fee: BaseFee;
  source: Ed25519PublicKey;
  timeout: number;
  signers: TransactionSigner[];
};

export type BaseFee = `${number}`;
