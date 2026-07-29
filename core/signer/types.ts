import type { ContractId, Ed25519PublicKey } from "@/strkeys/types.ts";
import type {
  BinaryData,
  SignableTransaction,
  SorobanAuthorizationEntryLike,
  TransactionXDRBase64,
} from "@/common/types/index.ts";

/**
 * A signer that can authorize a Stellar transaction envelope.
 */
export type EnvelopeSigner = {
  /** Signs a Stellar transaction or fee-bump envelope and returns its XDR. */
  signTransaction(
    tx: SignableTransaction,
  ): Promise<TransactionXDRBase64> | TransactionXDRBase64;
  /** Returns whether this signer can authorize the given target. */
  signsFor(target: Ed25519PublicKey | ContractId): boolean;
};

/**
 * A signer that can transform a Soroban authorization entry into an
 * authorized entry.
 */
export type AuthEntrySigner = {
  /** Signs a Soroban authorization entry and returns the signed entry. */
  signSorobanAuthEntry(
    authEntry: SorobanAuthorizationEntryLike,
    validUntilLedgerSeq: number,
    networkPassphrase: string,
    forAddress?: Ed25519PublicKey | ContractId,
  ): Promise<SorobanAuthorizationEntryLike>;
  /** Returns whether this signer can authorize the given target. */
  signsFor(target: Ed25519PublicKey | ContractId): boolean;
};

/**
 * Any signer capability accepted by Colibri.
 *
 * A signer can authorize transaction envelopes, Soroban authorization
 * entries, or both.
 */
export type Signer = EnvelopeSigner | AuthEntrySigner;

/**
 * Complete Ed25519 signing surface implemented by local keypair signers.
 */
export type KeypairSigner = EnvelopeSigner & AuthEntrySigner & {
  /** Returns the signer's Ed25519 public key. */
  publicKey(): Ed25519PublicKey;
  /** Signs an arbitrary binary payload. */
  sign(data: BinaryData): BinaryData;
};

/**
 * Multisig threshold schema attached to an account.
 */
export type MultiSigSchema = {
  lowThreshold: SigningThreshold;
  medThreshold: SigningThreshold;
  highThreshold: SigningThreshold;
};

/**
 * Signer entry discovered on an account.
 */
export type AccountSigner = {
  address: Ed25519PublicKey;
  weight: SigningThreshold;
};

/**
 * Weight assigned to a signer in a Stellar threshold schema.
 */
export type SigningThreshold = number;

/**
 * Signature requirement tied to a resolved source account.
 */
export type SignatureRequirement = SignatureRequirementRaw & {
  address: Ed25519PublicKey;
};

/**
 * Signature requirement before a concrete source account is resolved.
 */
export type SignatureRequirementRaw = {
  address: Ed25519PublicKey | "source-account";
  thresholdLevel: OperationThreshold;
};

/**
 * Threshold levels used by classic Stellar operations.
 */
export enum OperationThreshold {
  low = 1,
  medium = 2,
  high = 3,
}
