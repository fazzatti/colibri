/**
 * React wallets integration.
 * @module
 */
export * from "@/wallets.ts";

// Shared type exports are erased from the runtime bundle.
export type { WalletConnection, WalletConnector } from "@/config.ts";
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
} from "@colibri/core";
