import type { Ed25519PublicKey, MuxedAddress } from "@/strkeys/types.ts";
import type { Account } from "@/account/types.ts";
import type {
  LedgerKeyLike,
  TrustlineAssetLike,
} from "@/common/types/index.ts";

/**
 * String-encoded muxed account id accepted by {@link NativeAccount.muxedAddress}.
 */
export type MuxedId = `${number}`;

/**
 * Public surface implemented by native Stellar accounts.
 */
export interface INativeAccount extends Account {
  /** Returns the base Ed25519 public key backing the account. */
  address(): Ed25519PublicKey;
  /** Returns the muxed address generated for the provided id. */
  muxedAddress(id: MuxedId): MuxedAddress;
  /** Returns the ledger key for the account entry. */
  getAccountLedgerKey(): LedgerKeyLike;
  /** Returns the ledger key for the provided trustline asset. */
  getTrustlineLedgerKey(asset: TrustlineAssetLike): LedgerKeyLike;
}
