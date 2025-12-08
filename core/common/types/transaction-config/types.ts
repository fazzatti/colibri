import type { Signer } from "@/signer/types.ts";
import type {
  ContractId,
  Ed25519PublicKey,
  MuxedAddress,
} from "@/strkeys/types.ts";

export type TransactionConfig = {
  fee: BaseFee;
  source: Ed25519PublicKey;
  timeout: number;
  signers: Signer[];
};

export type BaseFee = `${number}`;

export type FeeBumpConfig = {
  fee: TransactionConfig["fee"];
  source: TransactionConfig["source"];
  signers: TransactionConfig["signers"];
};

export type Address = Ed25519PublicKey | ContractId | MuxedAddress;
