import { Address, type xdr } from "stellar-sdk";
import { assert } from "@/common/assert/assert.ts";
import type { ContractId, Ed25519PublicKey } from "@/strkeys/types.ts";
import { StrKey } from "@/strkeys/index.ts";
import {
  FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_SIGNER,
  FAILED_TO_GET_AUTH_ENTRY_SIGNER,
  INVALID_AUTH_ENTRY_SIGNER_ADDRESS,
  MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_SIGNER,
} from "@/common/helpers/xdr/error.ts";
import { getAddressCredentialsFromAuthEntry } from "@/common/helpers/xdr/get-address-credentials-from-auth-entry.ts";
import { softTryToXDR } from "@/common/helpers/xdr/soft-try-to-xdr.ts";

/**
 * Extracts the signer address from a Soroban authorization entry.
 *
 * @param authEntry - The Soroban authorization entry to extract the signer from
 * @returns The signer address as an Ed25519 public key or contract ID
 * @throws {FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_SIGNER} If the credentials cannot be read
 * @throws {MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_SIGNER} If the entry has no address credentials
 * @throws {FAILED_TO_GET_AUTH_ENTRY_SIGNER} If the credential address cannot be converted
 * @throws {INVALID_AUTH_ENTRY_SIGNER_ADDRESS} If the extracted address is invalid
 */
export const getAddressSignerFromAuthEntry = (
  authEntry: xdr.SorobanAuthorizationEntry,
): Ed25519PublicKey | ContractId => {
  const authEntryXDR = () => softTryToXDR(() => authEntry.toXdr("base64"));

  let addressCredentials: xdr.SorobanAddressCredentials | null;
  try {
    addressCredentials = getAddressCredentialsFromAuthEntry(authEntry);
  } catch (cause) {
    throw new FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_SIGNER(
      authEntryXDR(),
      cause instanceof Error ? cause : undefined,
    );
  }
  if (!addressCredentials) {
    throw new MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_SIGNER(
      authEntryXDR(),
    );
  }

  let signer: string;
  try {
    signer = Address.fromScAddress(
      addressCredentials.address,
    ).toString();
  } catch (cause) {
    throw new FAILED_TO_GET_AUTH_ENTRY_SIGNER(
      authEntryXDR(),
      cause instanceof Error ? cause : undefined,
    );
  }

  assert(
    StrKey.isValidEd25519PublicKey(signer) || StrKey.isValidContractId(signer),
    new INVALID_AUTH_ENTRY_SIGNER_ADDRESS(authEntryXDR(), signer),
  );

  return signer as Ed25519PublicKey;
};
