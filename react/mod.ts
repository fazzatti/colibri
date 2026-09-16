/**
 * Headless React configuration and connection state for Stellar.
 * @module
 */
export * from "@/context/config.ts";
export * from "@/context/provider.ts";
export * from "@/context/connection.ts";
export * from "@/errors/index.ts";

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
