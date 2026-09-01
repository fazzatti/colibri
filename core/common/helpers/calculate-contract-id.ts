import { Address, hash, xdr } from "stellar-sdk";
import { StrKey } from "@/strkeys/index.ts";
import type { BinaryData } from "@/common/types/index.ts";
import { toUint8Array } from "@/common/helpers/internal-bytes.ts";

/**
 * Calculates the expected contract ID from an address and salt.
 * The contract ID is derived by hashing a preimage containing:
 * - Network ID (hash of network passphrase)
 * - Contract ID preimage (address + salt)
 */
export function calculateContractId(
  networkPassphrase: string,
  sourceAddress: string,
  salt: BinaryData,
): string {
  const networkId = hash(new TextEncoder().encode(networkPassphrase));

  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: new Address(sourceAddress).toScAddress(),
          salt: toUint8Array(salt),
        }),
      ),
    }),
  );

  return StrKey.encodeContract(hash(preimage.toXdr()));
}
