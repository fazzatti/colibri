import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "buffer";
import { xdr, Address, Keypair } from "stellar-sdk";
import { getAddressSignerFromAuthEntry } from "@/common/helpers/xdr/get-address-signer-from-auth-entry.ts";
import {
  Code,
  FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_SIGNER,
  FAILED_TO_GET_AUTH_ENTRY_SIGNER,
  MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_SIGNER,
} from "@/common/helpers/xdr/error.ts";
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

    const error = assertThrows(
      () => getAddressSignerFromAuthEntry(invalidAuthEntry),
      FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_SIGNER
    );
    assertEquals(
      error.code,
      Code.FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_SIGNER,
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
      () => getAddressSignerFromAuthEntry(authEntry),
      MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_SIGNER
    );

    assertEquals(
      error.code,
      Code.MISSING_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_SIGNER,
    );
    assertEquals(error.meta.cause, null);
  });

  it("should normalize non-Error credential extraction failures", () => {
    const authEntry = {
      credentials: () => {
        throw "boom";
      },
      toXDR: () => "AAAA",
    } as unknown as xdr.SorobanAuthorizationEntry;

    const error = assertThrows(
      () => getAddressSignerFromAuthEntry(authEntry),
      FAILED_TO_GET_AUTH_ENTRY_ADDRESS_CREDENTIALS_FOR_SIGNER
    );

    assertEquals(error.meta.cause, null);
  });

  it("should preserve Error causes when signer extraction fails", () => {
    const authEntry = {
      credentials: () => ({
        address: () => ({
          address: () => {
            throw new Error("boom");
          },
        }),
      }),
      toXDR: () => "AAAA",
    } as unknown as xdr.SorobanAuthorizationEntry;

    const error = assertThrows(
      () => getAddressSignerFromAuthEntry(authEntry),
      FAILED_TO_GET_AUTH_ENTRY_SIGNER
    );

    assertEquals(error.meta?.cause?.message, "boom");
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

  it("should extract contract IDs from contract auth entries", () => {
    const contractAddress = Address.contract(Buffer.alloc(32, 7));

    const authEntry = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
        new xdr.SorobanAddressCredentials({
          address: contractAddress.toScAddress(),
          nonce: new xdr.Int64(0),
          signatureExpirationLedger: 0,
          signature: xdr.ScVal.scvVoid(),
        })
      ),
      rootInvocation: new xdr.SorobanAuthorizedInvocation({
        function:
          xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
            new xdr.InvokeContractArgs({
              contractAddress: contractAddress.toScAddress(),
              functionName: "test",
              args: [],
            })
          ),
        subInvocations: [],
      }),
    });

    const signer = getAddressSignerFromAuthEntry(authEntry);

    assertEquals(signer, contractAddress.toString());
    assert(StrKey.isValidContractId(signer));
  });

  it("should normalize non-Error signer extraction failures", () => {
    const authEntry = {
      credentials: () => ({
        address: () => ({
          address: () => {
            throw "boom";
          },
        }),
      }),
      toXDR: () => "AAAA",
    } as unknown as xdr.SorobanAuthorizationEntry;

    const error = assertThrows(
      () => getAddressSignerFromAuthEntry(authEntry),
      FAILED_TO_GET_AUTH_ENTRY_SIGNER
    );

    assertEquals(error.meta?.cause, null);
  });
});
