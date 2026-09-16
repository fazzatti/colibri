/**
 * Framework-independent, memory-only WebAuth sessions.
 * @module
 */
export * from "@/webauth/session/session.ts";

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
export type {
  ContractAuthContext,
  ContractAuthHandler,
  Sep10AuthenticateOptions,
  Sep10AuthenticationOptions,
  Sep10Challenge,
  Sep10Client,
  Sep10GetChallengeOptions,
  Sep10SignedChallenge,
  Sep45AuthenticateOptions,
  Sep45AuthenticationOptions,
  Sep45AuthorizeChallengeOptions,
  Sep45AuthorizedChallenge,
  Sep45Challenge,
  Sep45Client,
  Sep45GetChallengeOptions,
  Sep45PreparedChallenge,
  Sep45SimulationReceipt,
  WebAuthAuthenticationOptions,
  WebAuthClient,
  WebAuthProtocol,
  WebAuthToken,
} from "@colibri/webauth";
