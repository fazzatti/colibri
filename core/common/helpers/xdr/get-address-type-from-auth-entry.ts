import type { xdr } from "stellar-sdk";
import { FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE } from "@/common/helpers/xdr/error.ts";
import { getAddressCredentialsFromAuthEntry } from "@/common/helpers/xdr/get-address-credentials-from-auth-entry.ts";
import { softTryToXDR } from "@/common/helpers/xdr/soft-try-to-xdr.ts";

/**
 * Extracts the address type from a Soroban authorization entry.
 *
 * @param authEntry - The Soroban authorization entry to extract the address type from
 * @returns The address type name (e.g., "scAddressTypeAccount" or "scAddressTypeContract")
 * @throws {FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE} If the address type cannot be extracted
 */
export const getAddressTypeFromAuthEntry = (
  authEntry: xdr.SorobanAuthorizationEntry,
): typeof xdr.ScAddressType.prototype.name => {
  const authEntryXDR = () =>
    softTryToXDR(() => authEntry.toXDR("base64"));
  const extractionError = (cause?: unknown) =>
    new FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE(
      authEntryXDR(),
      cause instanceof Error ? cause : undefined,
    );

  let addressCredentials: xdr.SorobanAddressCredentials | null;
  try {
    addressCredentials = getAddressCredentialsFromAuthEntry(authEntry);
  } catch (cause) {
    throw extractionError(cause);
  }
  if (!addressCredentials) {
    throw extractionError();
  }

  try {
    return addressCredentials.address().switch().name;
  } catch (cause) {
    throw extractionError(cause);
  }
};
