import type { xdr } from "stellar-sdk";
import {
  FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_ADDRESS_TYPE,
  FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE,
  MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_ADDRESS_TYPE,
} from "@/common/helpers/xdr/error.ts";
import { getAddressCredentialsFromAuthEntry } from "@/common/helpers/xdr/get-address-credentials-from-auth-entry.ts";
import { softTryToXDR } from "@/common/helpers/xdr/soft-try-to-xdr.ts";

/**
 * Extracts the address type from a Soroban authorization entry.
 *
 * @param authEntry - The Soroban authorization entry to extract the address type from
 * @returns The address type name (e.g., "scAddressTypeAccount" or "scAddressTypeContract")
 * @throws {FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_ADDRESS_TYPE} If the credentials cannot be read
 * @throws {MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_ADDRESS_TYPE} If the entry has no address credentials
 * @throws {FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE} If the credential address type cannot be read
 */
export const getAddressTypeFromAuthEntry = (
  authEntry: xdr.SorobanAuthorizationEntry,
): typeof xdr.ScAddressType.prototype.name => {
  const authEntryXDR = () => softTryToXDR(() => authEntry.toXDR("base64"));

  let addressCredentials: xdr.SorobanAddressCredentials | null;
  try {
    addressCredentials = getAddressCredentialsFromAuthEntry(authEntry);
  } catch (cause) {
    throw new FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_ADDRESS_TYPE(
      authEntryXDR(),
      cause instanceof Error ? cause : undefined,
    );
  }
  if (!addressCredentials) {
    throw new MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_ADDRESS_TYPE(
      authEntryXDR(),
    );
  }

  try {
    return addressCredentials.address().switch().name;
  } catch (cause) {
    throw new FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE(
      authEntryXDR(),
      cause instanceof Error ? cause : undefined,
    );
  }
};
