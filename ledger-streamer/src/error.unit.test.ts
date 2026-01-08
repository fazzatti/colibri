// deno-lint-ignore-file require-await
import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import * as E from "@/error.ts";

// =============================================================================
// Tests: Error Classes
// =============================================================================

describe("LedgerStreamer Error Classes", () => {
  describe("RPC_ALREADY_SET (LDS_001)", () => {
    it("has correct properties", () => {
      const error = new E.RPC_ALREADY_SET();
      assertEquals(error.code, "LDS_001");
      assertEquals(error.domain, "ledger-streamer");
      assertEquals(error.message, "RPC client is already set");
    });
  });

  describe("ARCHIVE_RPC_ALREADY_SET (LDS_002)", () => {
    it("has correct properties", () => {
      const error = new E.ARCHIVE_RPC_ALREADY_SET();
      assertEquals(error.code, "LDS_002");
      assertEquals(error.domain, "ledger-streamer");
      assertEquals(error.message, "Archive RPC client is already set");
    });
  });

  describe("STREAMER_ALREADY_RUNNING (LDS_003)", () => {
    it("has correct properties", () => {
      const error = new E.STREAMER_ALREADY_RUNNING();
      assertEquals(error.code, "LDS_003");
      assertEquals(error.domain, "ledger-streamer");
      assertEquals(error.message, "Ledger streamer is already running");
    });
  });

  describe("RPC_NOT_HEALTHY (LDS_004)", () => {
    it("has correct properties", () => {
      const error = new E.RPC_NOT_HEALTHY();
      assertEquals(error.code, "LDS_004");
      assertEquals(error.domain, "ledger-streamer");
      assertEquals(error.message, "RPC server is not healthy");
    });
  });

  describe("LEDGER_TOO_OLD (LDS_005)", () => {
    it("has correct properties", () => {
      const error = new E.LEDGER_TOO_OLD(500, 1000);
      assertEquals(error.code, "LDS_005");
      assertEquals(error.domain, "ledger-streamer");
      assertEquals(
        error.message,
        "Requested ledger is older than the RPC retention period"
      );
      assertExists(error.meta.data);
    });
  });

  describe("LEDGER_TOO_HIGH (LDS_006)", () => {
    it("has correct properties", () => {
      const error = new E.LEDGER_TOO_HIGH(2000, 1000);
      assertEquals(error.code, "LDS_006");
      assertEquals(error.domain, "ledger-streamer");
      assertEquals(
        error.message,
        "Requested ledger is higher than the latest available ledger"
      );
      assertExists(error.meta.data);
    });
  });

  describe("MISSING_ARCHIVE_RPC (LDS_007)", () => {
    it("has correct properties", () => {
      const error = new E.MISSING_ARCHIVE_RPC();
      assertEquals(error.code, "LDS_007");
      assertEquals(error.domain, "ledger-streamer");
      assertEquals(error.message, "Archive RPC client is not configured");
    });
  });

  describe("INVALID_INGESTION_RANGE (LDS_008)", () => {
    it("has correct properties", () => {
      const error = new E.INVALID_INGESTION_RANGE(2000, 1000);
      assertEquals(error.code, "LDS_008");
      assertEquals(error.domain, "ledger-streamer");
      assertEquals(
        error.message,
        "Invalid ingestion range: startLedger is greater than stopLedger"
      );
      assertExists(error.meta.data);
    });
  });

  describe("RPC_REQUEST_FAILED (LDS_009)", () => {
    it("has correct properties", () => {
      const cause = new Error("Network timeout");
      const error = new E.RPC_REQUEST_FAILED("getLedgers", cause);
      assertEquals(error.code, "LDS_009");
      assertEquals(error.domain, "ledger-streamer");
      assertEquals(error.message, "RPC request failed: getLedgers");
      assertEquals(error.meta.cause, cause);
    });
  });

  describe("ERROR_LDS mapping", () => {
    it("contains all error codes", () => {
      assertEquals(E.ERROR_LDS.LDS_001, E.RPC_ALREADY_SET);
      assertEquals(E.ERROR_LDS.LDS_002, E.ARCHIVE_RPC_ALREADY_SET);
      assertEquals(E.ERROR_LDS.LDS_003, E.STREAMER_ALREADY_RUNNING);
      assertEquals(E.ERROR_LDS.LDS_004, E.RPC_NOT_HEALTHY);
      assertEquals(E.ERROR_LDS.LDS_005, E.LEDGER_TOO_OLD);
      assertEquals(E.ERROR_LDS.LDS_006, E.LEDGER_TOO_HIGH);
      assertEquals(E.ERROR_LDS.LDS_007, E.MISSING_ARCHIVE_RPC);
      assertEquals(E.ERROR_LDS.LDS_008, E.INVALID_INGESTION_RANGE);
      assertEquals(E.ERROR_LDS.LDS_009, E.RPC_REQUEST_FAILED);
    });

    it("has correct number of error codes", () => {
      assertEquals(Object.keys(E.ERROR_LDS).length, 9);
    });
  });
});
