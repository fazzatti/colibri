import { MuxedAccount } from "stellar-sdk";
import { assert } from "@/common/assert/assert.ts";
import * as E from "@/address/muxed-to-base-account/error.ts";
import type { Ed25519PublicKey, MuxedAddress } from "@/strkeys/types.ts";
import { StrKey } from "@/strkeys/index.ts";

/** Converts a muxed address into its base Ed25519 account address. */
export const muxedAddressToBaseAccount = (
  muxedAddress: MuxedAddress,
): Ed25519PublicKey => {
  assert(
    StrKey.isMuxedAddress(muxedAddress),
    new E.INVALID_MUXED_ADDRESS(muxedAddress)
  );

  let muxedAccount: MuxedAccount;
  try {
    muxedAccount = MuxedAccount.fromAddress(muxedAddress, "1");
  } catch (e) {
    throw new E.FAILED_TO_LOAD_MUXED_ACCOUNT_FROM_ADDRESS(
      muxedAddress,
      e as Error
    );
  }
  let publicKey: Ed25519PublicKey;
  try {
    publicKey = muxedAccount.baseAccount().accountId() as Ed25519PublicKey;
  } catch (e) {
    throw new E.FAILED_TO_RETRIEVE_THE_BASE_ACCOUNT_ID(
      muxedAddress,
      e as Error
    );
  }

  return publicKey as Ed25519PublicKey;
};
