/**
 * Serializable query identities and prefetch configuration.
 * @module
 */
export * from "@/query/options.ts";

// Shared type exports are erased from the runtime bundle.
export type {
  ColibriConfig,
  WalletConnection,
  WalletConnector,
} from "@/context/config.ts";
export type {
  AuthEntrySigner,
  ContractId,
  CustomNetworkConfig,
  Ed25519PublicKey,
  EnvelopeSigner,
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
