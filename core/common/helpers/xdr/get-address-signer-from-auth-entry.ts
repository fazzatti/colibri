import { Address, type xdr } from "stellar-sdk";
import { assert } from "@/common/assert/assert.ts";
import type { ContractId, Ed25519PublicKey } from "@/strkeys/types.ts";
import { StrKey } from "@/strkeys/index.ts";
import {
  FAILED_TO_GET_AUTH_ENTRY_SIGNER,
  INVALID_AUTH_ENTRY_SIGNER_ADDRESS,
} from "@/common/helpers/xdr/error.ts";

/**
 * Extracts the signer address from a Soroban authorization entry.
 *
 * @param authEntry - The Soroban authorization entry to extract the signer from
 * @returns The signer address as an Ed25519 public key or contract ID
 * @throws {FAILED_TO_GET_AUTH_ENTRY_SIGNER} If the signer cannot be extracted
 * @throws {INVALID_AUTH_ENTRY_SIGNER_ADDRESS} If the extracted address is invalid
 */
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
