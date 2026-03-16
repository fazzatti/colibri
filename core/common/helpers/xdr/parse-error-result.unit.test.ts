import { assert, assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr } from "stellar-sdk";
import { parseErrorResult } from "@/common/helpers/xdr/parse-error-result.ts";

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
