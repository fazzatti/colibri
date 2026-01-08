import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { xdr } from "stellar-sdk";
import { ensureXdrType } from "@/common/helpers/xdr/ensure-xdr-type.ts";
import { FAILED_TO_PARSE_XDR } from "@/common/helpers/xdr/error.ts";
import { loadLedgerFixtures } from "@/_internal/tests/fixtures/rpc/get_ledgers/index.ts";

describe("ensureXdrType", () => {
  // Use real fixture data for reliable XDR testing
  const fixtures = loadLedgerFixtures();
  const fixture = fixtures[0];

  it("should return already-parsed XDR object", () => {
    // Parse the header from fixture
    const header = xdr.LedgerHeaderHistoryEntry.fromXDR(
      fixture.headerXdr,
      "base64"
    ).header();

    // Passing an already-parsed object should return the same object
    const result = ensureXdrType(header, xdr.LedgerHeader);
    assertEquals(result, header);
  });

  it("should parse LedgerCloseMeta from base64 string", () => {
    const result = ensureXdrType(fixture.metadataXdr, xdr.LedgerCloseMeta);
    assertExists(result);
    // Verify it's a valid LedgerCloseMeta
    assertEquals(typeof result.switch(), "number");
  });

  it("should parse LedgerHeaderHistoryEntry from base64 string", () => {
    const result = ensureXdrType(
      fixture.headerXdr,
      xdr.LedgerHeaderHistoryEntry
    );
    assertExists(result);
    // Verify we can access the header
    const header = result.header();
    assertExists(header);
  });

  it("should parse from Uint8Array", () => {
    // First decode base64 to Uint8Array
    const binaryData = Uint8Array.from(atob(fixture.metadataXdr), (c) =>
      c.charCodeAt(0)
    );

    const result = ensureXdrType(binaryData, xdr.LedgerCloseMeta);
    assertExists(result);
    assertEquals(typeof result.switch(), "number");
  });

  it("should throw for invalid base64 string", () => {
    assertThrows(
      () => ensureXdrType("not-valid-base64!!!", xdr.LedgerCloseMeta),
      FAILED_TO_PARSE_XDR
    );
  });

  it("should throw for corrupted XDR data", () => {
    // Valid base64 but invalid XDR structure
    assertThrows(
      () => ensureXdrType("AAAA", xdr.LedgerCloseMeta),
      FAILED_TO_PARSE_XDR
    );
  });

  it("should handle XDR type without name property in error", () => {
    // Create a mock XDR type without a name property to test the fallback
    const mockXdrType = {
      fromXDR: () => {
        throw new Error("Parse failed");
      },
      // Intentionally no 'name' property to test "unknown" fallback
    };

    assertThrows(
      // deno-lint-ignore no-explicit-any
      () => ensureXdrType("AAAA", mockXdrType as any),
      FAILED_TO_PARSE_XDR,
      "unknown"
    );
  });
});
