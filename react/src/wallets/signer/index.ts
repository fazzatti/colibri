/**
 * Combined envelope and authorization signer for a wallet's G-account.
 * @module
 */
import type { AuthEntrySigner, EnvelopeSigner } from "@colibri/core/signers";
import type { Ed25519PublicKey } from "@colibri/core/strkey";
import { createWalletEnvelopeSigner } from "@/wallets/adapter.ts";
import { createWalletAuthEntrySigner } from "@/wallets/auth-entry/signer.ts";
/** Both explicit wallet signing callbacks for the same G-account. */
export interface WalletSignerOptions {
  /** Signer and authorization account. Custom account authority uses the granular factories. */
  address: Ed25519PublicKey;
  /** Wallet-reported network. */
  networkPassphrase: string;
  /** Sign a complete Classic, Soroban or fee-bump envelope. */
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;
  /** Sign an authorization entry without altering its invocation, nonce or expiry. */
  signAuthEntry(xdr: string, networkPassphrase: string): Promise<string>;
}
/** One Core signer implementing both capabilities; existing pipelines select the needed method. */
export function createWalletSigner(
  options: WalletSignerOptions,
): EnvelopeSigner & AuthEntrySigner {
  return {
    ...createWalletEnvelopeSigner({ ...options, publicKey: options.address }),
    ...createWalletAuthEntrySigner(options),
  };
}
export type { AuthEntrySigner, EnvelopeSigner } from "@colibri/core/signers";
export type {
  ContractId,
  Ed25519PublicKey,
  ExtraSignerKey,
  PreAuthTx,
  Sha256Hash,
  SignedPayload,
  SignerKey,
} from "@colibri/core/strkey";
export type { TransactionXDRBase64 } from "@colibri/core";
