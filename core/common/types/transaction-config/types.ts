import type { Signer } from "@/signer/types.ts";
import type {
  ContractId,
  Ed25519PublicKey,
  MuxedAddress,
} from "@/strkeys/types.ts";

/**
 * Transaction-level configuration shared by Colibri transaction builders.
 */
export type TransactionConfig = {
  /** Base fee in stroops applied to the transaction. */
  fee: BaseFee;
  /** Source account that will submit the transaction. */
  source: Ed25519PublicKey;
  /** Timeout, in seconds, applied to the transaction. */
  timeout: number;
  /** Signers used to authorize the transaction envelope. */
  signers: Signer[];
};

/**
 * String representation of a Stellar base fee value.
 */
export type BaseFee = `${number}`;

/**
 * Subset of transaction configuration required to build a fee-bump envelope.
 */
export type FeeBumpConfig = {
  fee: TransactionConfig["fee"];
  source: TransactionConfig["source"];
  signers: TransactionConfig["signers"];
};

/**
 * Any Stellar address shape accepted by Colibri transaction helpers.
 */
export type Address = Ed25519PublicKey | ContractId | MuxedAddress;
