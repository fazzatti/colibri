import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Address, buildWithDelegatesEntry, Operation, xdr } from "stellar-sdk";
import { Buffer } from "node:buffer";
import { getAddressCredentialsFromAuthEntry } from "@/common/helpers/xdr/get-address-credentials-from-auth-entry.ts";
import { getAddressSignerFromAuthEntry } from "@/common/helpers/xdr/get-address-signer-from-auth-entry.ts";
import { getAddressTypeFromAuthEntry } from "@/common/helpers/xdr/get-address-type-from-auth-entry.ts";
import { getAuthEntrySignatures } from "@/common/helpers/xdr/get-auth-entry-signatures.ts";
import { operationHasDelegatedAuthorization } from "@/common/helpers/xdr/operation-has-delegated-authorization.ts";

const rootAddress = Address.contract(Buffer.alloc(32, 1));
const delegateAddress = Address.account(Buffer.alloc(32, 2));
const nestedAddress = Address.contract(Buffer.alloc(32, 3));

const invocation = new xdr.SorobanAuthorizedInvocation({
  function: xdr.SorobanAuthorizedFunction
    .sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: rootAddress.toScAddress(),
        functionName: "authorize",
        args: [],
      }),
    ),
  subInvocations: [],
});

const makeAddressEntry = (
  variant: "address" | "addressV2" = "address",
) => {
  const credentials = new xdr.SorobanAddressCredentials({
    address: rootAddress.toScAddress(),
    nonce: xdr.Int64(1),
    signatureExpirationLedger: 0,
    signature: xdr.ScVal.scvVoid(),
  });

  return new xdr.SorobanAuthorizationEntry({
    credentials: variant === "address"
      ? xdr.SorobanCredentials.sorobanCredentialsAddress(credentials)
      : xdr.SorobanCredentials.sorobanCredentialsAddressV2(credentials),
    rootInvocation: invocation,
  });
};

const makeDelegatedEntry = () =>
  buildWithDelegatesEntry({
    entry: makeAddressEntry("addressV2"),
    validUntilLedgerSeq: 300,
    signature: xdr.ScVal.scvU32(1),
    delegates: [{
      address: delegateAddress.toString(),
      signature: xdr.ScVal.scvU32(2),
      nestedDelegates: [{
        address: nestedAddress.toString(),
        signature: xdr.ScVal.scvU32(3),
      }],
    }],
  });

describe("delegated authorization XDR helpers", () => {
  describe("getAddressCredentialsFromAuthEntry", () => {
    it("extracts legacy and V2 address credentials", () => {
      assertEquals(
        getAddressCredentialsFromAuthEntry(makeAddressEntry())?.address
          .toXdr("base64"),
        rootAddress.toScAddress().toXdr("base64"),
      );
      assertEquals(
        getAddressCredentialsFromAuthEntry(makeAddressEntry("addressV2"))
          ?.address.toXdr("base64"),
        rootAddress.toScAddress().toXdr("base64"),
      );
    });

    it("extracts the shared address credentials from delegated credentials", () => {
      assertEquals(
        getAddressCredentialsFromAuthEntry(makeDelegatedEntry())?.address
          .toXdr("base64"),
        rootAddress.toScAddress().toXdr("base64"),
      );
    });

    it("returns null for source-account credentials", () => {
      const sourceEntry = new xdr.SorobanAuthorizationEntry({
        credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
        rootInvocation: invocation,
      });

      assertEquals(getAddressCredentialsFromAuthEntry(sourceEntry), null);
      assertThrows(() => getAddressSignerFromAuthEntry(sourceEntry));
      assertThrows(() => getAddressTypeFromAuthEntry(sourceEntry));
    });

    it("supports structural legacy credential implementations", () => {
      const entry = makeAddressEntry();
      const expected = getAddressCredentialsFromAuthEntry(entry)!;
      const structuralEntry = {
        credentials: {
          type: "sorobanCredentialsAddress",
          address: expected,
        },
      } as unknown as xdr.SorobanAuthorizationEntry;

      assertEquals(
        getAddressCredentialsFromAuthEntry(structuralEntry),
        expected,
      );
    });
  });

  describe("getAuthEntrySignatures", () => {
    it("returns no signatures for source credentials", () => {
      const sourceEntry = new xdr.SorobanAuthorizationEntry({
        credentials: xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
        rootInvocation: invocation,
      });

      assertEquals(getAuthEntrySignatures(sourceEntry), []);
    });

    it("returns the single address signature", () => {
      assertEquals(
        getAuthEntrySignatures(makeAddressEntry()).map((signature) =>
          signature.type
        ),
        ["scvVoid"],
      );
    });

    it("walks delegated signatures in top-level-first order", () => {
      assertEquals(
        getAuthEntrySignatures(makeDelegatedEntry()).map((signature) =>
          signature.type === "scvU32" ? signature.u32 : undefined
        ),
        [1, 2, 3],
      );
    });
  });

  describe("operationHasDelegatedAuthorization", () => {
    it("detects delegated credentials in invoke-host-function operations", () => {
      const operation = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
          invocation.function.type ===
              "sorobanAuthorizedFunctionTypeContractFn"
            ? invocation.function.contractFn
            : neverContractFunction(),
        ),
        auth: [makeDelegatedEntry()],
      });

      assertEquals(operationHasDelegatedAuthorization(operation), true);
    });

    it("returns false for ordinary auth and non-contract operations", () => {
      const ordinary = Operation.invokeHostFunction({
        func: xdr.HostFunction.hostFunctionTypeInvokeContract(
          invocation.function.type ===
              "sorobanAuthorizedFunctionTypeContractFn"
            ? invocation.function.contractFn
            : neverContractFunction(),
        ),
        auth: [makeAddressEntry()],
      });

      assertEquals(operationHasDelegatedAuthorization(ordinary), false);
      assertEquals(
        operationHasDelegatedAuthorization(Operation.setOptions({})),
        false,
      );
    });
  });
});

function neverContractFunction(): never {
  throw new Error("Expected a contract-function invocation");
}
