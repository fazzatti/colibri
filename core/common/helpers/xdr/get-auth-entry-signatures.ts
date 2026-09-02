import type { xdr } from "stellar-sdk";
import { getAddressCredentialsFromAuthEntry } from "@/common/helpers/xdr/get-address-credentials-from-auth-entry.ts";

/**
 * Returns every signature value carried by an address-based authorization
 * entry, including recursively nested delegate signatures.
 *
 * @param authEntry - Authorization entry to inspect.
 * @returns Signature values in top-level-first traversal order.
 */
export const getAuthEntrySignatures = (
  authEntry: xdr.SorobanAuthorizationEntry,
): xdr.ScVal[] => {
  const credentials = authEntry.credentials;
  const addressCredentials = getAddressCredentialsFromAuthEntry(authEntry);

  if (!addressCredentials) return [];

  const signatures = [addressCredentials.signature];

  if (
    credentials.type !== "sorobanCredentialsAddressWithDelegates"
  ) {
    return signatures;
  }

  const collectNestedSignatures = (
    nestedDelegates: xdr.SorobanDelegateSignature[],
  ): void => {
    for (const delegate of nestedDelegates) {
      signatures.push(delegate.signature);
      collectNestedSignatures(delegate.nestedDelegates);
    }
  };

  collectNestedSignatures(credentials.addressWithDelegates.delegates);
  return signatures;
};
