import type { Asset, xdr } from "stellar-sdk";
import type {
  Ed25519PublicKey,
  MuxedAddress,
  ContractId,
} from "@/strkeys/types.ts";
import type { MultiSigSchema, Signer } from "@/signer/types.ts";

export type StellarAddress = Ed25519PublicKey | MuxedAddress | ContractId;

export interface Account {
  address(): StellarAddress;
  getAccountLedgerKey(): xdr.LedgerKey;
  getTrustlineLedgerKey(asset: Asset): xdr.LedgerKey;
}

export type WithoutSigner<T extends Account> = T & {
  withMasterSigner(signer: Signer): WithSigner<T>;
};

export type WithSigner<T> = T & {
  signer(): Signer;
};

export type WithMultiSig<T> = T & {
  getMultiSigSchema(): MultiSigSchema;
};
