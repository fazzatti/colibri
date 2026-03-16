import { Account, type Asset, Keypair, MuxedAccount, xdr } from "stellar-sdk";
import { assert } from "@/common/assert/assert.ts";
import { StrKey } from "@/strkeys/index.ts";
import { isMuxedId } from "@/common/type-guards/is-muxed-id.ts";
import type { Ed25519PublicKey, MuxedAddress } from "@/strkeys/types.ts";
import type { Signer } from "@/signer/types.ts";
import * as E from "@/account/native/error.ts";
import type { INativeAccount, MuxedId } from "@/account/native/types.ts";
import type {
  StellarAddress,
  WithSigner,
  WithoutSigner,
} from "@/account/types.ts";

export class NativeAccount implements INativeAccount {
  protected _publicKey: Ed25519PublicKey;
  protected _masterSigner?: Signer;

  private constructor(publicKey: Ed25519PublicKey) {
    assert(
      StrKey.isValidEd25519PublicKey(publicKey),
      new E.INVALID_ED25519_PUBLIC_KEY(publicKey)
    );

    this._publicKey = publicKey;
  }

  static fromAddress(address: StellarAddress): WithoutSigner<NativeAccount> {
    assert(
      StrKey.isEd25519PublicKey(address),
      new E.UNSUPPORTED_ADDRESS_TYPE(address)
    );
    return new NativeAccount(address) as WithoutSigner<NativeAccount>;
  }

  static fromPublicKey(
    address: Ed25519PublicKey
  ): WithoutSigner<NativeAccount> {
    return new NativeAccount(address) as WithoutSigner<NativeAccount>;
  }

  // ----------------
  // Base methods
  // ----------------

  address(): Ed25519PublicKey {
    return this._publicKey;
  }

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

  getAccountLedgerKey(): xdr.LedgerKey {
    const ledgerKey = xdr.LedgerKey.account(
      new xdr.LedgerKeyAccount({
        accountId: Keypair.fromPublicKey(this._publicKey).xdrPublicKey(),
      })
    );

    return ledgerKey;
  }

  getTrustlineLedgerKey(asset: Asset): xdr.LedgerKey {
    const trustlineLedgerKey = xdr.LedgerKey.trustline(
      new xdr.LedgerKeyTrustLine({
        accountId: Keypair.fromPublicKey(this._publicKey).xdrAccountId(),
        asset: asset.toTrustLineXDRObject(),
      })
    );

    return trustlineLedgerKey;
  }

  // ----------------
  // WithSigner methods
  // ----------------

  static fromMasterSigner(signer: Signer) {
    return NativeAccount.fromAddress(signer.publicKey()).withMasterSigner(
      signer
    );
  }

  withMasterSigner(signer: Signer): WithSigner<this> {
    this._masterSigner = signer;
    return this as WithSigner<this>;
  }

  signer(): Signer {
    assert(this._masterSigner, new E.MISSING_MASTER_SIGNER(this._publicKey));
    return this._masterSigner;
  }
}
