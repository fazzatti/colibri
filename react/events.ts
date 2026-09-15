/**
 * Shared, bounded contract event subscriptions.
 * @module
 */
export * from "@/events.ts";

// Shared type exports are erased from the runtime bundle.
export type {
  ColibriConfig,
  WalletConnection,
  WalletConnector,
} from "@/config.ts";
export type {
  AuthEntrySigner,
  ContractId,
  CustomNetworkConfig,
  Ed25519PublicKey,
  EnvelopeSigner,
  Event,
  EventFilter,
  EventId,
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
export type { StreamerOptions } from "@colibri/rpc-streamer";
