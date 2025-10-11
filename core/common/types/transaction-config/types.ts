import type { TransactionSigner } from "../../../signer/types.ts";
import type { Ed25519PublicKey } from "../../../strkeys/types.ts";

export type TransactionConfig = {
  fee: BaseFee;
  source: Ed25519PublicKey;
  timeout: number;
  signers: TransactionSigner[];
};

export type BaseFee = `${number}`;
