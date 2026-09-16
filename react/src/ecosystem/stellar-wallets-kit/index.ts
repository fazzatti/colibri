/**
 * Optional Stellar Wallets Kit adapter over Colibri's general wallet contract.
 * @module
 */
export { createStellarWalletsKitConnector } from "@/ecosystem/stellar-wallets-kit/connector.ts";
export type { WalletAuthEntryOptions } from "@/wallets/auth-entry/index.ts";
export type {
  StellarWalletsKitApi,
  StellarWalletsKitConnectorOptions,
  WalletsKitAccount,
  WalletsKitCapabilities,
} from "@/ecosystem/stellar-wallets-kit/types.ts";
export type { WalletConnection, WalletConnector } from "@/context/config.ts";
export type {
  AuthEntrySigner,
  ContractId,
  Ed25519PublicKey,
  EnvelopeSigner,
  ExtraSignerKey,
  MessageSigner,
  PreAuthTransactionSigner,
  PreAuthTx,
  Sha256Hash,
  SignedPayload,
  Signer,
  SignerKey,
  TransactionXDRBase64,
} from "@/wallets/index.ts";

export type { WalletSignerOptions } from "@/wallets/signer/index.ts";
