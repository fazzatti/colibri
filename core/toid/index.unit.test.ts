import { assert, assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { createTOID, isTOID, parseTOID } from "@/toid/index.ts";

describe("TOID Helpers", () => {
  describe("isTOID", () => {
    it("returns true for valid TOID strings", () => {
      assert(isTOID("0000530242871959553"));
      assert(isTOID("12345"));
      assert(isTOID("0"));
      assert(isTOID("9223372036854775807")); // Max signed 64-bit integer
    });

    it("returns false for non-numeric strings", () => {
      assert(!isTOID("abc"));
      assert(!isTOID("123a"));
      assert(!isTOID(""));
    });

    it("returns false for negative numbers", () => {
      assert(!isTOID("-1"));
      assert(!isTOID("-12345"));
    });

    it("returns false for numbers exceeding 64-bit signed integer range", () => {
      assert(!isTOID("9223372036854775808")); // Max + 1
    });

    it("returns false if BigInt throws (internal error safety)", () => {
      const originalBigInt = globalThis.BigInt;
      try {
        // Force BigInt to throw to test the catch block
        // @ts-ignore: Mocking global object for testing purposes
        globalThis.BigInt = () => {
          throw new Error("Simulated BigInt error");
        };
        assert(!isTOID("123"));
      } finally {
        globalThis.BigInt = originalBigInt;
      }
    });
  });

  describe("createTOID", () => {
    it("creates a valid TOID from components", () => {
      // Ledger: 123456, TxOrder: 1, OpIndex: 1
      // (123456 << 32) | (1 << 12) | (1-1)
      // 530239482494976 | 4096 | 0 = 530239482499072
      const toid = createTOID(123456, 1, 1);
      assertEquals(toid, "0000530239482499072");

      // Let's use a simple case:
      // Ledger 1, Tx 1, Op 1
      // (1 << 32) | (1 << 12) | 0
      // 4294967296 | 4096 | 0 = 4294971392
      const simpleToid = createTOID(1, 1, 1);
      assertEquals(simpleToid, "0000000004294971392");
    });

    it("pads the output to 19 characters", () => {
      const toid = createTOID(0, 1, 1);
      assertEquals(toid.length, 19);
      assertEquals(toid, "0000000000000004096"); // (0<<32)|(1<<12)|0 = 4096
    });

    it("throws if ledger sequence is out of bounds", () => {
      assertThrows(() => createTOID(-1, 1, 1));
      assertThrows(() => createTOID(2147483648, 1, 1)); // Max + 1
    });

    it("throws if transaction order is out of bounds", () => {
      assertThrows(() => createTOID(1, 0, 1)); // Min is 1
      assertThrows(() => createTOID(1, 1048576, 1)); // Max + 1
    });

    it("throws if operation index is out of bounds", () => {
      assertThrows(() => createTOID(1, 1, 0)); // Min is 1
      assertThrows(() => createTOID(1, 1, 4096)); // Max + 1
    });
  });

  describe("parseTOID", () => {
    it("correctly parses a TOID into components", () => {
      // Ledger 1, Tx 1, Op 1 -> 4294971392
      const parts = parseTOID("0000000004294971392");
      assertEquals(parts.ledgerSequence, 1);
      assertEquals(parts.transactionOrder, 1);
      assertEquals(parts.operationIndex, 1);
    });

    it("handles max values correctly", () => {
      // Max Ledger, Max Tx, Max Op
      const maxLedger = 2147483647;
      const maxTx = 1048575;
      const maxOp = 4095;

      const toid = createTOID(maxLedger, maxTx, maxOp);
      const parts = parseTOID(toid);

      assertEquals(parts.ledgerSequence, maxLedger);
      assertEquals(parts.transactionOrder, maxTx);
      assertEquals(parts.operationIndex, maxOp);
    });

    it("throws for invalid TOID strings", () => {
      assertThrows(() => parseTOID("invalid"));
    });
  });

  describe("Roundtrip", () => {
    it("createTOID -> parseTOID preserves values", () => {
      const ledger = 500;
      const tx = 20;
      const op = 5;

      const toid = createTOID(ledger, tx, op);
      const parsed = parseTOID(toid);

      assertEquals(parsed.ledgerSequence, ledger);
      assertEquals(parsed.transactionOrder, tx);
      assertEquals(parsed.operationIndex, op);
    });
  });
});
