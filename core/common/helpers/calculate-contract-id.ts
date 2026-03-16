import { hash, Address, xdr } from "stellar-sdk";
import { Buffer } from "buffer";
import { StrKey } from "@/strkeys/index.ts";

/**
 * Calculates the expected contract ID from an address and salt.
 * The contract ID is derived by hashing a preimage containing:
 * - Network ID (hash of network passphrase)
 * - Contract ID preimage (address + salt)
 */
export function calculateContractId(
  networkPassphrase: string,
  sourceAddress: string,
  salt: Buffer
): string {
  const networkId = hash(Buffer.from(networkPassphrase));

  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: new Address(sourceAddress).toScAddress(),
          salt,
        })
      ),
    })
  );

  return StrKey.encodeContract(hash(preimage.toXDR()));
}
