import type {
  Ed25519PublicKey,
  MuxedAddress,
  ContractId,
} from "@/strkeys/types.ts";
import type {
  LedgerKeyLike,
  TrustlineAssetLike,
} from "@/common/types/index.ts";
import type { MultiSigSchema, Signer } from "@/signer/types.ts";

/**
 * Union of address formats accepted by Colibri account helpers.
 */
export type StellarAddress = Ed25519PublicKey | MuxedAddress | ContractId;

/**
 * Common account surface implemented by Colibri account helpers.
 */
export interface Account {
  /** Returns the canonical address represented by the account helper. */
  address(): StellarAddress;
  /** Builds the ledger key that identifies the account entry. */
  getAccountLedgerKey(): LedgerKeyLike;
  /**
   * Builds the ledger key for a trustline entry owned by this account.
   *
   * @param asset - Asset whose trustline should be addressed.
   */
  getTrustlineLedgerKey(asset: TrustlineAssetLike): LedgerKeyLike;
}

/**
 * Account view that can be upgraded with a master signer.
 */
export type WithoutSigner<T extends Account> = T & {
  withMasterSigner(signer: Signer): WithSigner<T>;
};

/**
 * Account view that exposes a configured master signer.
 */
export type WithSigner<T extends Account> = T & {
  signer(): Signer;
};

/**
 * Account view that exposes multisig metadata.
 */
export type WithMultiSig<T extends Account> = T & {
  getMultiSigSchema(): MultiSigSchema;
};
