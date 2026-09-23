/**
 * Focused classic transaction APIs.
 * @module
 */
export * from "@/pipelines/classic-transaction/index.ts";
export type * from "@/pipelines/classic-transaction/types.ts";
export type * from "@/common/types/transaction-config/types.ts";
export type * from "@/common/types/transaction-config/resources.ts";

// Shared public types are erased from JavaScript consumer bundles.
export type {
  AuthEntrySigner,
  ContractId,
  Ed25519PublicKey,
  EnvelopeSigner,
  ExtraSignerKey,
  MuxedAddress,
  PreAuthTransactionSigner,
  PreAuthTx,
  Sha256Hash,
  SignedPayload,
  Signer,
  SignerKey,
  TransactionXDRBase64,
} from "@/types.ts";
