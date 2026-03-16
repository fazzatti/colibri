import type { Buffer } from "buffer";
import type { FeeBumpTransaction, Transaction, xdr } from "stellar-sdk";
import type { ContractId, Ed25519PublicKey } from "@/strkeys/types.ts";
import type { TransactionXDRBase64 } from "@/common/types/index.ts";

export type Signer = {
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
  signsFor(target: Ed25519PublicKey | ContractId): boolean;
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
