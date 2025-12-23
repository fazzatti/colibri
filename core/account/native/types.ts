import type { Asset, xdr } from "stellar-sdk";
import type { Ed25519PublicKey, MuxedAddress } from "@/strkeys/types.ts";
import type { Account } from "@/account/types.ts";

export type MuxedId = `${number}`;

export interface INativeAccount extends Account {
  address(): Ed25519PublicKey;
  muxedAddress(id: MuxedId): MuxedAddress;
  getAccountLedgerKey(): xdr.LedgerKey;
  getTrustlineLedgerKey(asset: Asset): xdr.LedgerKey;
}
