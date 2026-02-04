/**
 * @module ledger-parser/index.unit.test
 * @description Unit tests for LedgerParser module - Error classes and Fixture loader
 *
 * See also:
 * - ledger/index.unit.test.ts - Ledger class tests
 * - transaction/index.unit.test.ts - Transaction class tests
 * - operation/index.unit.test.ts - Operation class tests
 */

import { describe, it } from "@std/testing/bdd";
import { expect } from "@std/expect";
import { Ledger, Transaction, Operation } from "@/ledger-parser/index.ts";
import {
  loadLedgerFixtures,
  loadMultiVersionFixtures,
  loadV2Fixtures,
  getLedgerFixture,
} from "colibri-internal/tests/fixtures/rpc/get_ledgers/index.ts";
import {
  INVALID_LEDGER_ENTRY,
  INVALID_HEADER_XDR,
  INVALID_METADATA_XDR,
  UNSUPPORTED_LEDGER_CLOSE_META_VERSION,
  INVALID_TRANSACTION_INDEX,
  INVALID_OPERATION_INDEX,
  UNSUPPORTED_OPERATION_TYPE,
  ERROR_LDP,
  Code,
} from "@/ledger-parser/error.ts";

describe("LedgerParser", () => {
  describe("Module Exports", () => {
    it("should export Ledger class", () => {
      expect(Ledger).toBeDefined();
      expect(typeof Ledger.fromEntry).toBe("function");
    });

    it("should export Transaction class", () => {
      expect(Transaction).toBeDefined();
      expect(typeof Transaction.fromMeta).toBe("function");
      expect(typeof Transaction.fromMetaWithEnvelope).toBe("function");
    });

    it("should export Operation class", () => {
      expect(Operation).toBeDefined();
      expect(typeof Operation.fromXdr).toBe("function");
    });
  });

  describe("Error Classes", () => {
    it("should have correct error codes", () => {
      expect(Code.INVALID_LEDGER_ENTRY).toBe("LDP_001");
      expect(Code.INVALID_HEADER_XDR).toBe("LDP_002");
      expect(Code.INVALID_METADATA_XDR).toBe("LDP_003");
      expect(Code.UNSUPPORTED_LEDGER_CLOSE_META_VERSION).toBe("LDP_004");
      expect(Code.INVALID_TRANSACTION_INDEX).toBe("LDP_005");
      expect(Code.INVALID_OPERATION_INDEX).toBe("LDP_006");
      expect(Code.UNSUPPORTED_OPERATION_TYPE).toBe("LDP_007");
    });

    it("should create INVALID_LEDGER_ENTRY with reason", () => {
      const error = new INVALID_LEDGER_ENTRY("missing sequence");
      expect(error.code).toBe(Code.INVALID_LEDGER_ENTRY);
      expect(error.message).toContain("Invalid LedgerEntry");
      expect(error.details).toContain("missing sequence");
    });

    it("should create INVALID_HEADER_XDR with cause", () => {
      const cause = new Error("decode failed");
      const error = new INVALID_HEADER_XDR(cause);
      expect(error.code).toBe(Code.INVALID_HEADER_XDR);
      expect(error.message).toContain("Invalid header XDR");
    });

    it("should create INVALID_METADATA_XDR with cause", () => {
      const cause = new Error("decode failed");
      const error = new INVALID_METADATA_XDR(cause);
      expect(error.code).toBe(Code.INVALID_METADATA_XDR);
      expect(error.message).toContain("Invalid metadata XDR");
    });

    it("should create UNSUPPORTED_LEDGER_CLOSE_META_VERSION", () => {
      const error = new UNSUPPORTED_LEDGER_CLOSE_META_VERSION("v99");
      expect(error.code).toBe(Code.UNSUPPORTED_LEDGER_CLOSE_META_VERSION);
      expect(error.details).toContain("v99");
    });

    it("should create INVALID_TRANSACTION_INDEX", () => {
      const error = new INVALID_TRANSACTION_INDEX(5, 12345, 3);
      expect(error.code).toBe(Code.INVALID_TRANSACTION_INDEX);
      expect(error.details).toContain("5");
      expect(error.details).toContain("12345");
      expect(error.details).toContain("3");
    });

    it("should create INVALID_OPERATION_INDEX", () => {
      const error = new INVALID_OPERATION_INDEX(10, 2, 5);
      expect(error.code).toBe(Code.INVALID_OPERATION_INDEX);
      expect(error.details).toContain("10");
      expect(error.details).toContain("2");
      expect(error.details).toContain("5");
    });

    it("should create UNSUPPORTED_OPERATION_TYPE", () => {
      const error = new UNSUPPORTED_OPERATION_TYPE("unknownOp");
      expect(error.code).toBe(Code.UNSUPPORTED_OPERATION_TYPE);
      expect(error.details).toContain("unknownOp");
    });

    it("should export ERROR_LDP mapping", () => {
      expect(ERROR_LDP[Code.INVALID_LEDGER_ENTRY]).toBe(INVALID_LEDGER_ENTRY);
      expect(ERROR_LDP[Code.INVALID_HEADER_XDR]).toBe(INVALID_HEADER_XDR);
      expect(ERROR_LDP[Code.INVALID_METADATA_XDR]).toBe(INVALID_METADATA_XDR);
      expect(ERROR_LDP[Code.UNSUPPORTED_LEDGER_CLOSE_META_VERSION]).toBe(
        UNSUPPORTED_LEDGER_CLOSE_META_VERSION
      );
      expect(ERROR_LDP[Code.INVALID_TRANSACTION_INDEX]).toBe(
        INVALID_TRANSACTION_INDEX
      );
      expect(ERROR_LDP[Code.INVALID_OPERATION_INDEX]).toBe(
        INVALID_OPERATION_INDEX
      );
      expect(ERROR_LDP[Code.UNSUPPORTED_OPERATION_TYPE]).toBe(
        UNSUPPORTED_OPERATION_TYPE
      );
    });
  });

  describe("Fixture Loader", () => {
    it("should load all fixtures", () => {
      const all = loadLedgerFixtures();
      expect(all.length).toBe(4);
    });

    it("should get fixture by sequence", () => {
      const fixture = getLedgerFixture(60661500);
      expect(fixture).toBeDefined();
      expect(fixture?.sequence).toBe(60661500);

      const notFound = getLedgerFixture(99999999);
      expect(notFound).toBeUndefined();
    });

    it("should load v2 fixtures", () => {
      const v2 = loadV2Fixtures();
      expect(v2.length).toBe(2);
      expect(v2[0].sequence).toBe(60661500);
      expect(v2[1].sequence).toBe(60661501);
    });

    it("should load multi-version fixtures", () => {
      const multi = loadMultiVersionFixtures();
      expect(multi.lcm_v0.sequence).toBe(30000000);
      expect(multi.lcm_v1.sequence).toBe(55000000);
      expect(multi.lcm_v2.sequence).toBe(60661500);
    });
  });
});
