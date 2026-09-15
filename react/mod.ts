/**
 * Headless React configuration and connection state for Stellar.
 * @module
 */
export * from "@/config.ts";
export * from "@/provider.ts";
export * from "@/connection.ts";
export * from "@/error.ts";

// Shared type exports are erased from the runtime bundle.
export type {
  AuthEntrySigner,
  BaseMeta,
  ColibriError,
  ContractId,
  CustomNetworkConfig,
  Diagnostic,
  Ed25519PublicKey,
  EnvelopeSigner,
  ErrorDomain,
  ExtraSignerKey,
  FutureNetConfig,
  HorizonConfig,
  INetworkConfig,
  MainNetConfig,
  MessageSigner,
  NetworkConfig,
  NetworkPassphrase,
  NetworkType,
  PreAuthTransactionSigner,
  PreAuthTx,
  RPCConfig,
  Sha256Hash,
  SignedPayload,
  Signer,
  SignerKey,
  TestNetConfig,
  TransactionXDRBase64,
} from "@colibri/core";
