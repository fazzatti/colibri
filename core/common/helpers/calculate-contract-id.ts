import { Address, hash, xdr } from "stellar-sdk";
import { Buffer } from "buffer";
import { StrKey } from "@/strkeys/index.ts";
import type { BinaryData } from "@/common/types/index.ts";
import { toBuffer } from "@/common/helpers/internal-buffer.ts";

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
  const networkId = hash(Buffer.from(networkPassphrase));

  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: new Address(sourceAddress).toScAddress(),
          salt: toBuffer(salt),
        }),
      ),
    }),
  );

  return StrKey.encodeContract(hash(preimage.toXDR()));
}
