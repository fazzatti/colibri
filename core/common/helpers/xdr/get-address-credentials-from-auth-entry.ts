import { xdr } from "stellar-sdk";
import { UNSUPPORTED_AUTH_ENTRY_CREDENTIALS } from "@/common/helpers/xdr/error.ts";

/** Address-based Soroban credential variants supported by Protocol 27. */
export type AuthEntryAddressCredentials =
  | {
    type: "address";
    addressCredentials: xdr.SorobanAddressCredentials;
  }
  | {
    type: "addressV2";
    addressCredentials: xdr.SorobanAddressCredentials;
  }
  | {
    type: "addressWithDelegates";
    addressCredentials: xdr.SorobanAddressCredentials;
    delegates: xdr.SorobanDelegateSignature[];
  };

/**
 * Returns address credentials for any supported Soroban address credential arm.
 * Source-account credentials return `null` because they carry no address data.
 */
export const tryGetAddressCredentialsFromAuthEntry = (
  authEntry: xdr.SorobanAuthorizationEntry,
): AuthEntryAddressCredentials | null => {
  const credentials = authEntry.credentials();

  switch (credentials.switch().value) {
    case xdr.SorobanCredentialsType.sorobanCredentialsAddress().value:
      return {
        type: "address",
        addressCredentials: credentials.address(),
      };

    case xdr.SorobanCredentialsType.sorobanCredentialsAddressV2().value:
      return {
        type: "addressV2",
        addressCredentials: credentials.addressV2(),
      };

    case xdr.SorobanCredentialsType
      .sorobanCredentialsAddressWithDelegates().value: {
      const delegated = credentials.addressWithDelegates();
      return {
        type: "addressWithDelegates",
        addressCredentials: delegated.addressCredentials(),
        delegates: delegated.delegates(),
      };
    }

    default:
      return null;
  }
};

/** Returns address credentials or throws a typed error for a non-address arm. */
export const getAddressCredentialsFromAuthEntry = (
  authEntry: xdr.SorobanAuthorizationEntry,
): AuthEntryAddressCredentials => {
  const addressCredentials = tryGetAddressCredentialsFromAuthEntry(authEntry);
  if (addressCredentials) return addressCredentials;

  throw new UNSUPPORTED_AUTH_ENTRY_CREDENTIALS(
    authEntry.toXDR("base64"),
    authEntry.credentials().switch().name,
  );
};
