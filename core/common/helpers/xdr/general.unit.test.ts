import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Address, Keypair } from "stellar-sdk";
import {
  getAddressTypeFromAuthEntry,
  getAddressSignerFromAuthEntry,
  softTryToXDR,
  parseEvents,
  parseErrorResult,
} from "@/common/helpers/xdr/general.ts";
import { StrKey } from "@/strkeys/index.ts";

describe("XDR Helpers", () => {
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
  });

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
  });

  describe("softTryToXDR", () => {
    it("should convert to XDR successfully", () => {
      const result = softTryToXDR(() => "test-xdr");
      assertEquals(result, "test-xdr");
    });

    it("should return error message on failure", () => {
      const result = softTryToXDR(() => {
        throw new Error("Conversion failed");
      });
      assertEquals(result, "Failed to convert to XDR");
    });
  });

  describe("parseEvents", () => {
    it("should parse events successfully", () => {
      const events: xdr.ContractEvent[] = [];
      const result = parseEvents(events);
      assertExists(result);
      assert(Array.isArray(result));
    });

    it("should return null for undefined events", () => {
      const result = parseEvents(undefined);
      assertEquals(result, null);
    });
  });

  describe("parseErrorResult", () => {
    it("should return null for undefined error result", () => {
      const result = parseErrorResult(undefined);
      assertEquals(result, null);
    });

    it("should parse error result with switch", () => {
      const errorResult = new xdr.TransactionResult({
        feeCharged: new xdr.Int64(100),
        result: xdr.TransactionResultResult.txSuccess([]),
        ext: xdr.TransactionResultExt.fromXDR("AAAAAA==", "base64"),
      });

      const result = parseErrorResult(errorResult);
      assertExists(result);
      assert(Array.isArray(result));
    });

    it("should parse error result with results", () => {
      // Create a minimal transaction result with operation results
      const errorResult = new xdr.TransactionResult({
        feeCharged: new xdr.Int64(100),
        result: xdr.TransactionResultResult.txFailed([]),
        ext: xdr.TransactionResultExt.fromXDR("AAAAAA==", "base64"),
      });

      const result = parseErrorResult(errorResult);
      assertExists(result);
      assert(Array.isArray(result));
      assertEquals(result.length, 1); // Returns switch name "txFailed"
      assertEquals(result[0], "txFailed");
    });

    it("should parse error result using results flatMap when switch is missing", () => {
      // Mock an error result that has results() but no valid switch().name
      const mockResult = {
        result: () => ({
          switch: null, // No switch method
          results: () => [
            { toString: () => "operation_result_1" },
            { toString: () => "operation_result_2" },
          ],
        }),
      } as unknown as xdr.TransactionResult;

      const result = parseErrorResult(mockResult);
      assertExists(result);
      assert(Array.isArray(result));
      assertEquals(result.length, 2);
      assertEquals(result[0], "operation_result_1");
      assertEquals(result[1], "operation_result_2");
    });

    it("should throw error for unexpected TransactionResult format", () => {
      const invalidErrorResult = {
        result: () => ({
          // Missing switch, results, and flatMap
        }),
      } as unknown as xdr.TransactionResult;

      assertThrows(() => parseErrorResult(invalidErrorResult));
    });
  });
});
