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
}

/**
 * Minimal signer surface required to authorize a fee-bump envelope.
 */
export interface FeeBumpPluginSigner {
  /**
   * Returns the signer's Stellar address.
   *
   * This is only used for diagnostics when Colibri cannot match a signer.
   */
  publicKey(): string;

  /**
   * Returns whether this signer can authorize the given Stellar address.
   *
   * @param target - Required Stellar address.
   * @returns `true` when this signer can sign for the address.
   */
  signsFor(target: string): boolean;

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
