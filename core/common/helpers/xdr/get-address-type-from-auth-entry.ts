import type { xdr } from "stellar-sdk";
import { FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE } from "@/common/helpers/xdr/error.ts";

/**
 * Extracts the address type from a Soroban authorization entry.
 *
 * @param authEntry - The Soroban authorization entry to extract the address type from
 * @returns The address type name (e.g., "scAddressTypeAccount" or "scAddressTypeContract")
 * @throws {FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE} If the address type cannot be extracted
 */
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
