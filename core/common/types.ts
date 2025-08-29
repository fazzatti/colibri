import { FeeBumpTransaction, Transaction, xdr } from "stellar-sdk";

export type TransactionXDRBase64 = string;

export type Ed25519SecretKey = `S${string}`;
export type Ed25519PublicKey = `G${string}`;
export type MuxedAddress = `M${string}`;
export type SmartContractId = `C${string}`;

export type TransactionSigner = {
  getPublicKey(): Ed25519PublicKey;
  sign(
    tx: Transaction | FeeBumpTransaction
  ): Promise<TransactionXDRBase64> | TransactionXDRBase64;
  signSorobanAuthEntry(
    authEntry: xdr.SorobanAuthorizationEntry,
    validUntilLedgerSeq: number,
    networkPassphrase: string
  ): Promise<xdr.SorobanAuthorizationEntry>;
};

// export type TransactionInvocation = {
//   signers: AccountHandler[];
//   header: EnvelopeHeader;
//   feeBump?: FeeBumpHeader;
//   sponsor?: AccountHandler;
// };

// export type SorobanSimulationInvocation = {
//   header: EnvelopeHeader;
// };

// export type EnvelopeHeader = {
//   fee: string;
//   source: string;
//   timeout: number;
// };

// export type FeeBumpHeader = {
//   signers: AccountHandler[];
//   header: EnvelopeHeader;
// };

// export type SignatureRequirement = {
//   publicKey: string;
//   thresholdLevel: SignatureThreshold;
// };

// export enum SignatureThreshold {
//   low = 1,
//   medium = 2,
//   high = 3,
// }
