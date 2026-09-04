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
  /** Fee value or explicit fee strategy applied to the transaction. */
  fee: BaseFee | TransactionFee;
  /** G-address or M-address that will submit the transaction. */
  source: TransactionSource;
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
 * Account address accepted as a transaction or fee-bump source.
 *
 * Muxed sources retain their M-address in the envelope while sharing sequence
 * state and authorization with their underlying G-account.
 */
export type TransactionSource = Ed25519PublicKey | MuxedAddress;

/**
 * String representation of a Stellar base fee value.
 */
export type BaseFee = `${number}`;

/**
 * String representation of an exact transaction inclusion fee in stroops.
 */
export type InclusionFee = `${number}`;

/**
 * String representation of the maximum total transaction fee in stroops.
 */
export type MaxFee = `${number}`;

/**
 * Explicit transaction-fee strategy.
 *
 * Exactly one strategy must be provided. `base` configures the Stellar SDK's
 * per-operation base-fee bid, `inclusion` configures the transaction's exact
 * total inclusion-fee bid, and `max` caps the complete transaction fee,
 * including Soroban resources.
 */
export type TransactionFee =
  | {
    /** Maximum base-fee bid per operation. */
    base: BaseFee;
    inclusion?: never;
    max?: never;
  }
  | {
    base?: never;
    /** Exact total inclusion-fee bid for the transaction. */
    inclusion: InclusionFee;
    max?: never;
  }
  | {
    base?: never;
    inclusion?: never;
    /** Maximum total transaction fee, including Soroban resource fees. */
    max: MaxFee;
  };

/**
 * Subset of transaction configuration required to build a fee-bump envelope.
 */
export type FeeBumpConfig = {
  fee: BaseFee;
  source: TransactionConfig["source"];
  signers: (EnvelopeSigner | PreAuthTransactionSigner)[];
};

/**
 * Any Stellar address shape accepted by Colibri transaction helpers.
 */
export type Address = Ed25519PublicKey | ContractId | MuxedAddress;
