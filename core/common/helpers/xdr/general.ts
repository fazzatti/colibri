import { Address, humanizeEvents, type xdr } from "stellar-sdk";
import { assert } from "@/common/assert/assert.ts";
import type { ContractId, Ed25519PublicKey } from "@/strkeys/types.ts";
import { StrKey } from "@/strkeys/index.ts";
import {
  FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE,
  FAILED_TO_GET_AUTH_ENTRY_SIGNER,
  FAILED_TO_PARSE_ERROR_RESULT,
  INVALID_AUTH_ENTRY_SIGNER_ADDRESS,
} from "@/common/helpers/xdr/error.ts";

export const getAddressTypeFromAuthEntry = (
  authEntry: xdr.SorobanAuthorizationEntry
): typeof xdr.ScAddressType.prototype.name => {
  try {
    return authEntry.credentials().address().address().switch().name;
  } catch (e) {
    throw new FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE(
      authEntry.toXDR("base64"),
      e instanceof Error ? e : undefined
    );
  }
};

export const getAddressSignerFromAuthEntry = (
  authEntry: xdr.SorobanAuthorizationEntry
): Ed25519PublicKey | ContractId => {
  let signer: string;
  try {
    signer = Address.fromScAddress(
      authEntry.credentials().address().address()
    ).toString();
  } catch (e) {
    throw new FAILED_TO_GET_AUTH_ENTRY_SIGNER(
      authEntry.toXDR("base64"),
      e instanceof Error ? e : undefined
    );
  }

  assert(
    StrKey.isValidEd25519PublicKey(signer) || StrKey.isValidContractId(signer),
    new INVALID_AUTH_ENTRY_SIGNER_ADDRESS(authEntry.toXDR("base64"), signer)
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

  throw new FAILED_TO_PARSE_ERROR_RESULT(
    softTryToXDR(() => errorResult.toXDR("base64"))
  );
};
