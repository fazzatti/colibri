import { xdr } from "stellar-sdk";

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
  const credentials = authEntry.credentials();

  // Preserve compatibility with structural authorization-entry implementations
  // that expose the legacy address accessor without an XDR union switch.
  if (typeof credentials.switch !== "function") {
    return credentials.address();
  }

  switch (credentials.switch().value) {
    case xdr.SorobanCredentialsType.sorobanCredentialsAddress().value:
      return credentials.address();
    case xdr.SorobanCredentialsType.sorobanCredentialsAddressV2().value:
      return credentials.addressV2();
    case xdr.SorobanCredentialsType.sorobanCredentialsAddressWithDelegates()
      .value:
      return credentials.addressWithDelegates().addressCredentials();
    default:
      return null;
  }
};
