import type { ContractId, Ed25519PublicKey, SignerKey } from "@colibri/core";

/**
 * Stable identifier used by the fee-bump plugin.
 */
export const FEE_BUMP_PLUGIN_ID = "FeeBumpPlugin";

/**
 * Pipeline target id handled by the fee-bump plugin.
 */
export const FEE_BUMP_PLUGIN_TARGET = "send-transaction";

/**
 * Minimal transaction surface accepted by fee-bump signers.
 *
 * Signers receive the concrete Stellar SDK transaction instance at runtime, but
 * the public plugin surface only requires this smaller structural contract.
 */
export interface FeeBumpSignableTransaction {
  /** Network passphrase attached to the envelope. */
  networkPassphrase: string;
  /** Inner envelope fee, in stroops. */
  fee: string;
  /** Serializes the transaction into XDR. */
  toXDR(format?: "raw" | "hex" | "base64"): string | Uint8Array;
  /** Applies one or more signatures to the envelope. */
  sign(...signers: unknown[]): unknown;
  /** Returns the network-bound transaction hash. */
  hash(): Uint8Array;
}

/**
 * Identity and account-targeting surface shared by fee-bump authorizers.
 */
export interface FeeBumpPluginSignerIdentity {
  /**
   * Returns the exact Stellar signer key represented by this signer.
   *
   * This can be a `G...`, `X...`, `P...`, or `T...` key.
   */
  signerKey(): SignerKey;

  /**
   * Returns whether this signer can authorize the given Stellar address.
   *
   * @param target - Required Stellar address.
   * @returns `true` when this signer can sign for the address.
   */
  signsFor(
    target: Ed25519PublicKey | ContractId,
  ): boolean;
}

/**
 * Fee-bump signer that adds a decorated signature to the envelope.
 */
export interface FeeBumpEnvelopeSigner extends FeeBumpPluginSignerIdentity {
  /**
   * Signs the fee-bump envelope and returns the updated XDR.
   *
   * @param transaction - Fee-bump envelope to sign.
   * @returns Base64 XDR containing the updated signatures.
   */
  signTransaction(
    transaction: FeeBumpSignableTransaction,
  ): string | Promise<string>;
}

/**
 * Fee-bump signer that authorizes one exact transaction hash without adding a
 * decorated signature.
 */
export interface FeeBumpPreAuthorizedTransactionSigner
  extends FeeBumpPluginSignerIdentity {
  /**
   * Returns whether this signer authorizes the exact fee-bump transaction.
   *
   * @param transaction - Final fee-bump transaction to verify.
   * @returns Whether the transaction hash matches the pre-authorized key.
   */
  authorizesTransaction(
    transaction: FeeBumpSignableTransaction,
  ): boolean | Promise<boolean>;
}

/**
 * Signer mechanisms supported by the fee-bump plugin.
 */
export type FeeBumpPluginSigner =
  | FeeBumpEnvelopeSigner
  | FeeBumpPreAuthorizedTransactionSigner;

/**
 * Network information required to build fee-bump envelopes.
 */
export interface FeeBumpPluginNetworkConfig {
  /** Stellar network passphrase used to build the outer envelope. */
  networkPassphrase: string;
}

/**
 * Configuration describing how the fee-bump envelope should be authored.
 */
export interface FeeBumpPluginConfig {
  /** Stellar account that will pay the fee-bump fee. */
  source: string;
  /** Base fee, in stroops, assigned to the fee-bump envelope. */
  fee: `${number}`;
  /** Signers used to authorize the fee-bump envelope. */
  signers: FeeBumpPluginSigner[];
}

/**
 * Arguments accepted by {@link createFeeBumpPlugin}.
 */
export interface FeeBumpPluginArgs {
  /** Network configuration used to build the fee-bump envelope. */
  networkConfig: FeeBumpPluginNetworkConfig;
  /** Fee-bump configuration describing the fee payer and signers. */
  feeBumpConfig: FeeBumpPluginConfig;
}
