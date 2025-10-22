import type { FeeBumpTransaction, Transaction, xdr } from "stellar-sdk";
import type { Ed25519PublicKey } from "../strkeys/types.ts";
import type { TransactionXDRBase64 } from "../mod.ts";
import type { Buffer } from "buffer";

export type TransactionSigner = {
  publicKey(): Ed25519PublicKey;
  sign(data: Buffer): Buffer;
  signTransaction(
    tx: Transaction | FeeBumpTransaction
  ): Promise<TransactionXDRBase64> | TransactionXDRBase64;
  signSorobanAuthEntry(
    authEntry: xdr.SorobanAuthorizationEntry,
    validUntilLedgerSeq: number,
    networkPassphrase: string
  ): Promise<xdr.SorobanAuthorizationEntry>;
  verifySignature(data: Buffer, signature: Buffer): boolean;
};

export type MultiSigSchema = {
  lowThreshold: SigningThreshold;
  medThreshold: SigningThreshold;
  highThreshold: SigningThreshold;
};

export type AccountSigner = {
  address: Ed25519PublicKey;
  weight: SigningThreshold;
};

export type SigningThreshold = number;

export type SignatureRequirement = SignatureRequirementRaw & {
  address: Ed25519PublicKey;
};

export type SignatureRequirementRaw = {
  address: Ed25519PublicKey | "source-account";
  thresholdLevel: OperationThreshold;
};

export enum OperationThreshold {
  low = 1,
  medium = 2,
  high = 3,
}

// export type Signer<PK, SignIn, SignOut> = {
//   publicKey: PK;
//   sign: (data: SignIn) => Promise<SignOut> | SignOut;
// };

// export type Ed25519Signer = Signer<
//   Ed25519PublicKey,
//   Transaction | FeeBumpTransaction,
//   TransactionXDRBase64
// >;
