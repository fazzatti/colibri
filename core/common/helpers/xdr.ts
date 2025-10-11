import { Address, humanizeEvents, type xdr } from "stellar-sdk";
import { ColibriError } from "../../error/index.ts";

import { assert } from "../assert/assert.ts";
import type { Ed25519PublicKey } from "../../strkeys/types.ts";
import { StrKey } from "../../strkeys/index.ts";

enum ErrorCode {
  FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE = "HLP_XDR_01",
  FAILED_TO_GET_AUTH_ENTRY_SIGNER = "HLP_XDR_02",
  INVALID_AUTH_ENTRY_SIGNER_ADDRESS = "HLP_XDR_03",
  FAILED_TO_PARSE_ERROR_RESULT = "HLP_XDR_04",
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
    StrKey.isValidEd25519PublicKey(signer),
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

export const softTryToXDR = (fnToXDR: () => string) => {
  try {
    return fnToXDR();
  } catch {
    return "Failed to convert to XDR";
  }
};

export const parseEvents = (
  events?: xdr.DiagnosticEvent[] | xdr.ContractEvent[]
): ReturnType<typeof humanizeEvents> | null => {
  return events ? humanizeEvents(events) : null;
};

export const parseErrorResult = (
  errorResult?: xdr.TransactionResult
): string[] | null => {
  if (!errorResult) return null;

  if (
    errorResult.result &&
    errorResult.result().switch &&
    errorResult.result().switch().name
  ) {
    return [errorResult.result().switch().name];
  }

  if (
    errorResult.result &&
    errorResult.result().results &&
    errorResult.result().results().flatMap
  ) {
    return errorResult
      .result()
      .results()
      .flatMap((r) => r.toString());
  }

  throw ColibriError.unexpected({
    domain: "helpers",
    source: baseErrorSource + "/parseErrorResult",
    message: "Unexpected format of TransactionResult XDR!",
    details: `The TransactionResult XDR does not match the expected format. See the meta section for the XDR provided.`,
    code: ErrorCode.FAILED_TO_PARSE_ERROR_RESULT,
    meta: {
      data: {
        errorResultXDR: softTryToXDR(() => errorResult.toXDR("base64")),
      },
    },
  });
};
