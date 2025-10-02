import { Address, type xdr } from "stellar-sdk";
import { ColibriError } from "../../error/index.ts";
import type { Ed25519PublicKey } from "../types.ts";

import { isEd25519PublicKey } from "../verifiers/is-ed25519-public-key.ts";
import { assert } from "../assert/assert.ts";

enum ErrorCode {
  FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE = "HLP_XDR_01",
  FAILED_TO_GET_AUTH_ENTRY_SIGNER = "HLP_XDR_02",
  INVALID_AUTH_ENTRY_SIGNER_ADDRESS = "HLP_XDR_03",
}

const baseErrorSource = "@colibri/core/helpers/xdr";

export const getAddressTypeFromAuthEntry = (
  authEntry: xdr.SorobanAuthorizationEntry
): typeof xdr.ScAddressType.prototype.name => {
  try {
    return authEntry.credentials().address().address().switch().name;
  } catch (e) {
    throw ColibriError.fromUnknown(e, {
      domain: "helpers",
      source: baseErrorSource + "/getAddressTypeFromAuthEntry",
      message: "Failed to get address type from SorobanAuthorizationEntry!",
      code: ErrorCode.FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE,
      meta: {
        data: {
          authEntryXDR: authEntry.toXDR("base64"),
        },
      },
    });
  }
};

export const getAddressSignerFromAuthEntry = (
  authEntry: xdr.SorobanAuthorizationEntry
): Ed25519PublicKey => {
  let signer: string;
  try {
    signer = Address.account(
      authEntry.credentials().address().address().accountId().ed25519()
    ).toString();
  } catch (e) {
    const message =
      "Failed to get address type from SorobanAuthorizationEntry!";

    throw ColibriError.fromUnknown(e, {
      domain: "helpers",
      source: baseErrorSource + "/xdr",
      message,
      code: ErrorCode.FAILED_TO_GET_AUTH_ENTRY_SIGNER,
      meta: {
        data: {
          authEntryXDR: authEntry.toXDR("base64"),
        },
      },
    });
  }

  assert(
    isEd25519PublicKey(signer),
    ColibriError.unexpected({
      domain: "helpers",
      source: baseErrorSource + "/getAddressSignerFromAuthEntry",
      message:
        "Invalid signer address extracted from SorobanAuthorizationEntry!",
      code: ErrorCode.INVALID_AUTH_ENTRY_SIGNER_ADDRESS,
      meta: {
        data: {
          authEntryXDR: authEntry.toXDR("base64"),
        },
      },
    })
  );

  return signer as Ed25519PublicKey;
};
