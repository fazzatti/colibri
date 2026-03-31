import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Address, Keypair } from "stellar-sdk";
import { getAddressTypeFromAuthEntry } from "@/common/helpers/xdr/get-address-type-from-auth-entry.ts";
import { FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE } from "@/common/helpers/xdr/error.ts";

describe("getAddressTypeFromAuthEntry", () => {
  it("should get address type from auth entry", () => {
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

    const addressType = getAddressTypeFromAuthEntry(authEntry);

    assertExists(addressType);
    assertEquals(addressType, "scAddressTypeAccount");
  });

  it("should throw error for invalid auth entry", () => {
    const invalidAuthEntry = {} as unknown as xdr.SorobanAuthorizationEntry;

    assertThrows(() => getAddressTypeFromAuthEntry(invalidAuthEntry));
  });

  it("should preserve Error causes when address type extraction fails", () => {
    const authEntry = {
      credentials: () => ({
        address: () => ({
          address: () => ({
            switch: () => {
              throw new Error("boom");
            },
          }),
        }),
      }),
      toXDR: () => "AAAA",
    } as unknown as xdr.SorobanAuthorizationEntry;

    const error = assertThrows(
      () => getAddressTypeFromAuthEntry(authEntry),
      FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE
    );

    assertEquals(error.meta?.cause?.message, "boom");
  });

  it("should normalize non-Error address type failures", () => {
    const authEntry = {
      credentials: () => ({
        address: () => ({
          address: () => ({
            switch: () => {
              throw "boom";
            },
          }),
        }),
      }),
      toXDR: () => "AAAA",
    } as unknown as xdr.SorobanAuthorizationEntry;

    const error = assertThrows(
      () => getAddressTypeFromAuthEntry(authEntry),
      FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE
    );

    assertEquals(error.meta?.cause, null);
  });
});
