import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Address, Keypair, xdr } from "stellar-sdk";
import { getAddressTypeFromAuthEntry } from "@/common/helpers/xdr/get-address-type-from-auth-entry.ts";
import {
  Code,
  FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_ADDRESS_TYPE,
  FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE,
  MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_ADDRESS_TYPE,
} from "@/common/helpers/xdr/error.ts";

describe("getAddressTypeFromAuthEntry", () => {
  it("should get address type from auth entry", () => {
    const kp = Keypair.random();
    const address = Address.fromString(kp.publicKey());

    const authEntry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: address.toScAddress(),
          nonce: xdr.Int64(0),
          signatureExpirationLedger: 0,
          signature: xdr.ScVal.scvVoid(),
        }),
      ),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction
          .sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: address.toScAddress(),
              functionName: "test",
              args: [],
            }),
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

    const error = assertThrows(
      () => getAddressTypeFromAuthEntry(invalidAuthEntry),
      FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_ADDRESS_TYPE,
    );
    assertEquals(
      error.code,
      Code.FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_ADDRESS_TYPE,
    );
  });

  it("should throw a typed error for source-account credentials", () => {
    const address = Address.fromString(Keypair.random().publicKey());
    const authEntry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function: xdr.SorobanAuthorizedFunction
          .sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: address.toScAddress(),
              functionName: "test",
              args: [],
            }),
          ),
        subInvocations: [],
      }),
    });

    const error = assertThrows(
      () => getAddressTypeFromAuthEntry(authEntry),
      MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_ADDRESS_TYPE,
    );

    assertEquals(
      error.code,
      Code.MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_ADDRESS_TYPE,
    );
    assertEquals(error.meta.cause, null);
  });

  it("should normalize non-Error credential extraction failures", () => {
    const authEntry = {
      get credentials(): never {
        throw "boom";
      },
      toXdr: () => "AAAA",
    } as unknown as xdr.SorobanAuthorizationEntry;

    const error = assertThrows(
      () => getAddressTypeFromAuthEntry(authEntry),
      FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_ADDRESS_TYPE,
    );

    assertEquals(error.meta.cause, null);
  });

  it("should preserve Error causes when address type extraction fails", () => {
    const authEntry = {
      credentials: {
        type: "sorobanCredentialsAddress",
        address: {
          address: {
            get type(): never {
              throw new Error("boom");
            },
          },
        },
      },
      toXdr: () => "AAAA",
    } as unknown as xdr.SorobanAuthorizationEntry;

    const error = assertThrows(
      () => getAddressTypeFromAuthEntry(authEntry),
      FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE,
    );

    assertEquals(error.meta?.cause?.message, "boom");
  });

  it("should normalize non-Error address type failures", () => {
    const authEntry = {
      credentials: {
        type: "sorobanCredentialsAddress",
        address: {
          address: {
            get type(): never {
              throw "boom";
            },
          },
        },
      },
      toXdr: () => "AAAA",
    } as unknown as xdr.SorobanAuthorizationEntry;

    const error = assertThrows(
      () => getAddressTypeFromAuthEntry(authEntry),
      FAILED_TO_GET_AUTH_ENTRY_ADDRESS_TYPE,
    );

    assertEquals(error.meta?.cause, null);
  });
});
