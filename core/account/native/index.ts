import { Account, type Asset, Keypair, MuxedAccount, xdr } from "stellar-sdk";
import { assert } from "../../common/assert/assert.ts";
import { StrKey } from "../../strkeys/index.ts";
import { isMuxedId } from "../../common/verifiers/is-muxed-id.ts";
import type { MuxedId } from "./types.ts";
import type { Ed25519PublicKey, MuxedAddress } from "../../strkeys/types.ts";

import * as E from "./error.ts";
import type { TransactionSigner } from "../../signer/types.ts";
import type { WithSigner } from "./types.ts";
export class NativeAccount {
  protected _address: Ed25519PublicKey;
  protected _masterSigner?: TransactionSigner;

  constructor(address: Ed25519PublicKey) {
    assert(
      StrKey.isValidEd25519PublicKey(address),
      new E.INVALID_ED25519_PUBLIC_KEY(address)
    );

    this._address = address;
  }

  static fromAddress(address: Ed25519PublicKey): NativeAccount {
    return new NativeAccount(address);
  }

  // ----------------
  // Base methods
  // ----------------
  muxedAddress(id: MuxedId): MuxedAddress {
    assert(isMuxedId(id), new E.INVALID_MUXED_ID(id));

    const baseAcc = new Account(this._address, "1");
    const acc = new MuxedAccount(baseAcc, id);
    const muxedAddress = acc.accountId();

    assert(
      StrKey.isValidMuxedAddress(muxedAddress),
      new E.INVALID_MUXED_ADDRESS_GENERATED(muxedAddress, id, this._address)
    );

    return muxedAddress as MuxedAddress;
  }

  getAccountLedgerKey(): xdr.LedgerKey {
    const ledgerKey = xdr.LedgerKey.account(
      new xdr.LedgerKeyAccount({
        accountId: Keypair.fromPublicKey(this._address).xdrPublicKey(),
      })
    );

    return ledgerKey;
  }

  getTrustlineLedgerKey(asset: Asset): xdr.LedgerKey {
    const trustlineLedgerKey = xdr.LedgerKey.trustline(
      new xdr.LedgerKeyTrustLine({
        accountId: Keypair.fromPublicKey(this._address).xdrAccountId(),
        asset: asset.toTrustLineXDRObject(),
      })
    );

    return trustlineLedgerKey;
  }

  // ----------------
  // WithSigner methods
  // ----------------

  static fromMasterSigner(signer: TransactionSigner): NativeAccount {
    return new NativeAccount(signer.publicKey());
  }

  withMasterSigner(signer: TransactionSigner): WithSigner<this> {
    this._masterSigner = signer;
    return this as WithSigner<this>;
  }

  signer(): TransactionSigner {
    assert(this._masterSigner, new E.MISSING_MASTER_SIGNER(this._address));
    return this._masterSigner;
  }
}
