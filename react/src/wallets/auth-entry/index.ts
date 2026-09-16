/**
 * Explicit Soroban authorization signing for browser wallets.
 * @module
 */
export { createWalletAuthEntrySigner } from "@/wallets/auth-entry/signer.ts";
export type { WalletAuthEntryOptions } from "@/wallets/auth-entry/signer.ts";
export type { AuthEntrySigner } from "@colibri/core/signers";
export type { ContractId, Ed25519PublicKey } from "@colibri/core/strkey";
