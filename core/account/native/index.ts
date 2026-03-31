import { Account, type Asset, Keypair, MuxedAccount, xdr } from "stellar-sdk";
import { assert } from "@/common/assert/assert.ts";
import { StrKey } from "@/strkeys/index.ts";
import { isMuxedId } from "@/common/type-guards/is-muxed-id.ts";
import type { Ed25519PublicKey, MuxedAddress } from "@/strkeys/types.ts";
import type {
  LedgerKeyLike,
  TrustlineAssetLike,
} from "@/common/types/index.ts";
import type { Signer } from "@/signer/types.ts";
import * as E from "@/account/native/error.ts";
import type { INativeAccount, MuxedId } from "@/account/native/types.ts";
import type {
  StellarAddress,
  WithSigner,
  WithoutSigner,
} from "@/account/types.ts";

/**
 * Native Stellar account implementation backed by an Ed25519 public key.
 */
export class NativeAccount implements INativeAccount {
  /** Stored public key for the native account instance. */
  protected _publicKey: Ed25519PublicKey;
  /** Optional master signer used to authorize transactions for this account. */
  protected _masterSigner?: Signer;

  private constructor(publicKey: Ed25519PublicKey) {
    assert(
      StrKey.isValidEd25519PublicKey(publicKey),
      new E.INVALID_ED25519_PUBLIC_KEY(publicKey)
    );

    this._publicKey = publicKey;
  }

  /**
   * Creates a native account from any supported Stellar address.
   *
   * @param address - Base account address to wrap.
   * @returns A native account without an attached signer.
   */
  static fromAddress(address: StellarAddress): WithoutSigner<NativeAccount> {
    assert(
      StrKey.isEd25519PublicKey(address),
      new E.UNSUPPORTED_ADDRESS_TYPE(address)
    );
    return new NativeAccount(address) as WithoutSigner<NativeAccount>;
  }

  /**
   * Creates a native account from an Ed25519 public key.
   *
   * @param address - Base account public key.
   * @returns A native account without an attached signer.
   */
  static fromPublicKey(
    address: Ed25519PublicKey
  ): WithoutSigner<NativeAccount> {
    return new NativeAccount(address) as WithoutSigner<NativeAccount>;
  }

  // ----------------
  // Base methods
  // ----------------

  /** Returns the base account address for this native account. */
  address(): Ed25519PublicKey {
    return this._publicKey;
  }

  /**
   * Builds a muxed address for the account using the provided muxed id.
   *
   * @param id - Muxed id to embed in the generated address.
   * @returns A muxed address derived from this account.
   */
  muxedAddress(id: MuxedId): MuxedAddress {
    assert(isMuxedId(id), new E.INVALID_MUXED_ID(id));

    const baseAcc = new Account(this._publicKey, "1");
    const acc = new MuxedAccount(baseAcc, id);
    const muxedAddress = acc.accountId();

    assert(
      StrKey.isValidMuxedAddress(muxedAddress),
      new E.INVALID_MUXED_ADDRESS_GENERATED(muxedAddress, id, this._publicKey)
    );

    return muxedAddress as MuxedAddress;
  }

  /**
   * Returns the ledger key identifying this account entry.
   *
   * @returns Account ledger key for direct ledger lookups.
   */
  getAccountLedgerKey(): LedgerKeyLike {
    const ledgerKey = xdr.LedgerKey.account(
      new xdr.LedgerKeyAccount({
        accountId: Keypair.fromPublicKey(this._publicKey).xdrPublicKey(),
      })
    );

    return ledgerKey;
  }

  /**
   * Returns the trustline ledger key for the provided asset.
   *
   * @param asset - Trustline asset to resolve.
   * @returns Trustline ledger key for direct ledger lookups.
   */
  getTrustlineLedgerKey(asset: TrustlineAssetLike): LedgerKeyLike {
    const trustlineLedgerKey = xdr.LedgerKey.trustline(
      new xdr.LedgerKeyTrustLine({
        accountId: Keypair.fromPublicKey(this._publicKey).xdrAccountId(),
        asset: (asset as Asset).toTrustLineXDRObject(),
      })
    );

    return trustlineLedgerKey;
  }

  // ----------------
  // WithSigner methods
  // ----------------

  /**
   * Creates a native account and immediately binds its master signer.
   *
   * @param signer - Signer whose public key identifies the account.
   * @returns A signer-backed native account.
   */
  static fromMasterSigner(signer: Signer): WithSigner<NativeAccount> {
    return NativeAccount.fromAddress(signer.publicKey()).withMasterSigner(
      signer
    );
  }

  /**
   * Attaches a master signer to this native account instance.
   *
   * @param signer - Signer used to authorize account actions.
   * @returns The same account instance with signer capabilities.
   */
  withMasterSigner(signer: Signer): WithSigner<this> {
    this._masterSigner = signer;
    return this as WithSigner<this>;
  }

  /**
   * Returns the configured master signer.
   *
   * @returns Bound signer for the account.
   */
  signer(): Signer {
    assert(this._masterSigner, new E.MISSING_MASTER_SIGNER(this._publicKey));
    return this._masterSigner;
  }
}
