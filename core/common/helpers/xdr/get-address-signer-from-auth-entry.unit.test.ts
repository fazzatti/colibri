import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Address, Keypair } from "stellar-sdk";
import { getAddressSignerFromAuthEntry } from "@/common/helpers/xdr/get-address-signer-from-auth-entry.ts";
import { StrKey } from "@/strkeys/index.ts";

describe("getAddressSignerFromAuthEntry", () => {
  it("should extract signer from auth entry", () => {
    const kp = Keypair.random();
    const address = Address.fromString(kp.publicKey());

    const authEntry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: address.toScAddress(),
          nonce: new xdr.Int64(0),
          signatureExpirationLedger: 0,
          signature: xdr.ScVal.scvVoid(),
        })
      ),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function:
          xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: address.toScAddress(),
              functionName: "test",
              args: [],
            })
          ),
        subInvocations: [],
      }),
    });

    const signer = getAddressSignerFromAuthEntry(authEntry);

    assertExists(signer);
    assert(StrKey.isValidEd25519PublicKey(signer));
    assertEquals(signer, kp.publicKey());
  });

  it("should throw error for invalid auth entry", () => {
    const invalidAuthEntry = {} as unknown as xdr.SorobanAuthorizationEntry;

    assertThrows(() => getAddressSignerFromAuthEntry(invalidAuthEntry));
  });

  it("should throw error for invalid signer address format", () => {
    // Mock Address.fromScAddress to return an invalid address
    const originalFromScAddress = Address.fromScAddress;

    // Create a valid auth entry structure but mock the address extraction
    const kp = Keypair.random();
    const address = Address.fromString(kp.publicKey());

    const authEntry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: address.toScAddress(),
          nonce: new xdr.Int64(0),
          signatureExpirationLedger: 0,
          signature: xdr.ScVal.scvVoid(),
        })
      ),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function:
          xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: address.toScAddress(),
              functionName: "test",
              args: [],
            })
          ),
        subInvocations: [],
      }),
    });

    // Override Address.fromScAddress to return an invalid address
    // deno-lint-ignore no-explicit-any
    (Address as any).fromScAddress = () => ({
      toString: () => "INVALID_ADDRESS_FORMAT",
    });

    try {
      assertThrows(() => getAddressSignerFromAuthEntry(authEntry));
    } finally {
      // Restore original method
      // deno-lint-ignore no-explicit-any
      (Address as any).fromScAddress = originalFromScAddress;
    }
  });
});
