import type {
  EnvelopeSigner,
  PreAuthTransactionSigner,
  Signer,
} from "@/signer/types.ts";
import type {
  ContractId,
  Ed25519PublicKey,
  ExtraSignerKey,
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
  /**
   * Signers used to authorize transaction envelopes and Soroban authorization
   * entries.
   */
  signers: Signer[];
  /**
   * Exact signer keys that must additionally authorize the transaction.
   *
   * Stellar permits Ed25519, Hash-X, and signed-payload keys here.
   * Pre-authorized transaction keys are intentionally excluded.
   */
  extraSigners?: ExtraSignerKey[];
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
  signers: (EnvelopeSigner | PreAuthTransactionSigner)[];
};

/**
 * Any Stellar address shape accepted by Colibri transaction helpers.
 */
export type Address = Ed25519PublicKey | ContractId | MuxedAddress;
