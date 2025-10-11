import type { Asset, xdr } from "stellar-sdk";
import type { Ed25519PublicKey, MuxedAddress } from "../../strkeys/types.ts";
import type { MultiSigSchema, TransactionSigner } from "../../signer/types.ts";

export type MuxedId = `${number}`;

export type NativeAccount = {
  address(): Ed25519PublicKey;
  muxedAddress(id: MuxedId): MuxedAddress;
  getAccountLedgerKey(): xdr.LedgerKey;
  getTrustlineLedgerKey(asset: Asset): xdr.LedgerKey;
};

export type WithoutSigner<AccountType> = AccountType & {
  withMasterSigner(signer: TransactionSigner): WithSigner<NativeAccount>;
};

export type WithSigner<AccountType> = AccountType & {
  signer(): TransactionSigner;
};

export type WithMultiSig<AccountType> = AccountType & {
  getMultiSigSchema(): MultiSigSchema;
};
