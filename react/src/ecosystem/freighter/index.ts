/**
 * Optional Freighter integration; inject the application's SDK instance.
 * @module
 */
export {
  createFreighterConnector,
  type FreighterConnectorOptions,
} from "@/ecosystem/freighter/connector.ts";
export type { FreighterApi } from "@/ecosystem/freighter/types.ts";
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
