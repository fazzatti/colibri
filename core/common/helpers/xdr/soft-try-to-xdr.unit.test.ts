import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { softTryToXDR } from "@/common/helpers/xdr/soft-try-to-xdr.ts";

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
