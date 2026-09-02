import type { xdr } from "stellar-sdk";

/**
 * Extracts address credentials from any address-based Soroban authorization
 * credential variant.
 *
 * @param authEntry - Authorization entry whose address credentials are needed.
 * @returns The shared address credentials, or `null` for source-account
 * credentials.
 */
export const getAddressCredentialsFromAuthEntry = (
  authEntry: xdr.SorobanAuthorizationEntry,
): xdr.SorobanAddressCredentials | null => {
  const credentials = authEntry.credentials;

  switch (credentials.type) {
    case "sorobanCredentialsAddress":
      return credentials.address;
    case "sorobanCredentialsAddressV2":
      return credentials.addressV2;
    case "sorobanCredentialsAddressWithDelegates":
      return credentials.addressWithDelegates.addressCredentials;
    default:
      return null;
  }
};
