import { assert, assertEquals, assertFalse, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  isEventId,
  createEventId,
  createEventIdFromParts,
  parseEventId,
} from "./index.ts";
import type { TOID } from "@/toid/types.ts";
import * as E from "@/event/event-id/error.ts";

// =============================================================================
// Tests: isEventId
// =============================================================================

describe("isEventId", () => {
  describe("valid Event IDs", () => {
    it("returns true for valid Event ID format", () => {
      assert(isEventId("0000000000000123456-0000000001"));
      assert(isEventId("0000530242871959553-0000000000"));
      assert(isEventId("9223372036854775807-9999999999"));
    });

    it("returns true for minimum valid values", () => {
      assert(isEventId("0000000000000000000-0000000000"));
    });

    it("returns true for maximum valid values", () => {
      assert(isEventId("9223372036854775807-9999999999"));
    });
  });

  describe("invalid Event IDs", () => {
    it("returns false for empty string", () => {
      assertFalse(isEventId(""));
    });

    it("returns false for missing hyphen", () => {
      assertFalse(isEventId("00000000000001234560000000001"));
    });

    it("returns false for wrong TOID length", () => {
      assertFalse(isEventId("000000000000012345-0000000001")); // 18 chars TOID
      assertFalse(isEventId("00000000000001234567-0000000001")); // 20 chars TOID
    });

    it("returns false for wrong event index length", () => {
      assertFalse(isEventId("0000000000000123456-000000001")); // 9 chars
      assertFalse(isEventId("0000000000000123456-00000000001")); // 11 chars
    });

    it("returns false for non-numeric characters in TOID", () => {
      assertFalse(isEventId("000000000000012345a-0000000001"));
      assertFalse(isEventId("abcdefghijklmnopqrs-0000000001"));
    });

    it("returns false for non-numeric characters in event index", () => {
      assertFalse(isEventId("0000000000000123456-000000000a"));
      assertFalse(isEventId("0000000000000123456-abcdefghij"));
    });

    it("returns false for negative numbers", () => {
      assertFalse(isEventId("-000000000000123456-0000000001"));
      assertFalse(isEventId("0000000000000123456--000000001"));
    });

    it("returns false for TOID exceeding 64-bit signed integer range", () => {
      assertFalse(isEventId("9223372036854775808-0000000001")); // Max + 1
    });

    it("returns false for multiple hyphens", () => {
      assertFalse(isEventId("0000000000000123456-0000000001-extra"));
    });
  });
});

// =============================================================================
// Tests: createEventId
// =============================================================================

describe("createEventId", () => {
  describe("valid inputs", () => {
    it("creates Event ID from TOID and event index", () => {
      const toid = "0000530242871959553" as TOID;
      const eventId = createEventId(toid, 1);

      assertEquals(eventId, "0000530242871959553-0000000000");
    });

    it("creates Event ID with minimum event index", () => {
      const toid = "0000000000000000001" as TOID;
      const eventId = createEventId(toid, 1);

      assertEquals(eventId, "0000000000000000001-0000000000");
    });

    it("creates Event ID with maximum event index", () => {
      const toid = "0000000000000000001" as TOID;
      const eventId = createEventId(toid, 9999999999);

      assertEquals(eventId, "0000000000000000001-9999999998");
    });

    it("pads TOID to 19 characters", () => {
      const toid = "123456" as TOID;
      const eventId = createEventId(toid, 1);

      assertEquals(eventId, "0000000000000123456-0000000000");
    });

    it("pads event index to 10 characters", () => {
      const toid = "0000530242871959553" as TOID;
      const eventId = createEventId(toid, 42);

      assertEquals(eventId, "0000530242871959553-0000000041");
    });

    it("converts 1-based event index to 0-based in output", () => {
      const toid = "0000530242871959553" as TOID;

      assertEquals(createEventId(toid, 1), "0000530242871959553-0000000000");
      assertEquals(createEventId(toid, 2), "0000530242871959553-0000000001");
      assertEquals(createEventId(toid, 10), "0000530242871959553-0000000009");
    });
  });

  describe("invalid inputs", () => {
    it("throws EVENT_INDEX_OUT_OF_RANGE for event index 0", () => {
      const toid = "0000530242871959553" as TOID;

      assertThrows(() => createEventId(toid, 0), E.EVENT_INDEX_OUT_OF_RANGE);
    });

    it("throws EVENT_INDEX_OUT_OF_RANGE for negative event index", () => {
      const toid = "0000530242871959553" as TOID;

      assertThrows(() => createEventId(toid, -1), E.EVENT_INDEX_OUT_OF_RANGE);
    });

    it("throws EVENT_INDEX_OUT_OF_RANGE for event index exceeding maximum", () => {
      const toid = "0000530242871959553" as TOID;

      assertThrows(
        () => createEventId(toid, 10000000000),
        E.EVENT_INDEX_OUT_OF_RANGE
      );
    });
  });
});

// =============================================================================
// Tests: createEventIdFromParts
// =============================================================================

describe("createEventIdFromParts", () => {
  describe("valid inputs", () => {
    it("creates Event ID from ledger components", () => {
      const eventId = createEventIdFromParts(123456, 1, 1, 1);

      assert(isEventId(eventId));
    });

    it("creates consistent Event IDs", () => {
      const eventId1 = createEventIdFromParts(100, 1, 1, 1);
      const eventId2 = createEventIdFromParts(100, 1, 1, 1);

      assertEquals(eventId1, eventId2);
    });

    it("creates different Event IDs for different ledger sequences", () => {
      const eventId1 = createEventIdFromParts(100, 1, 1, 1);
      const eventId2 = createEventIdFromParts(101, 1, 1, 1);

      assert(eventId1 !== eventId2);
    });

    it("creates different Event IDs for different transaction orders", () => {
      const eventId1 = createEventIdFromParts(100, 1, 1, 1);
      const eventId2 = createEventIdFromParts(100, 2, 1, 1);

      assert(eventId1 !== eventId2);
    });

    it("creates different Event IDs for different operation indices", () => {
      const eventId1 = createEventIdFromParts(100, 1, 1, 1);
      const eventId2 = createEventIdFromParts(100, 1, 2, 1);

      assert(eventId1 !== eventId2);
    });

    it("creates different Event IDs for different event indices", () => {
      const eventId1 = createEventIdFromParts(100, 1, 1, 1);
      const eventId2 = createEventIdFromParts(100, 1, 1, 2);

      assert(eventId1 !== eventId2);
    });

    it("handles minimum ledger sequence (0)", () => {
      const eventId = createEventIdFromParts(0, 1, 1, 1);

      assert(isEventId(eventId));
    });

    it("handles maximum valid values", () => {
      const eventId = createEventIdFromParts(2147483647, 1048575, 4095, 1);

      assert(isEventId(eventId));
    });
  });

  describe("invalid inputs", () => {
    it("throws for invalid ledger sequence", () => {
      assertThrows(() => createEventIdFromParts(-1, 1, 1, 1));
      assertThrows(() => createEventIdFromParts(2147483648, 1, 1, 1));
    });

    it("throws for invalid transaction order", () => {
      assertThrows(() => createEventIdFromParts(100, 0, 1, 1));
      assertThrows(() => createEventIdFromParts(100, 1048576, 1, 1));
    });

    it("throws for invalid operation index", () => {
      assertThrows(() => createEventIdFromParts(100, 1, 0, 1));
      assertThrows(() => createEventIdFromParts(100, 1, 4096, 1));
    });

    it("throws for invalid event index", () => {
      assertThrows(() => createEventIdFromParts(100, 1, 1, 0));
      assertThrows(() => createEventIdFromParts(100, 1, 1, -1));
    });
  });
});

// =============================================================================
// Tests: parseEventId
// =============================================================================

describe("parseEventId", () => {
  describe("valid Event IDs", () => {
    it("parses Event ID into components", () => {
      const eventId = createEventIdFromParts(123456, 1, 1, 1);
      const parts = parseEventId(eventId);

      assertEquals(parts.ledgerSequence, 123456);
      assertEquals(parts.transactionOrder, 1);
      assertEquals(parts.operationIndex, 1);
      assertEquals(parts.eventIndex, 0); // 0-based output
    });

    it("parses Event ID with various event indices", () => {
      const eventId = createEventIdFromParts(100, 1, 1, 5);
      const parts = parseEventId(eventId);

      assertEquals(parts.eventIndex, 4); // 5 - 1 = 4 (0-based)
    });

    it("parses Event ID with large values", () => {
      const eventId = createEventIdFromParts(2147483647, 1048575, 4095, 100);
      const parts = parseEventId(eventId);

      assertEquals(parts.ledgerSequence, 2147483647);
      assertEquals(parts.transactionOrder, 1048575);
      assertEquals(parts.operationIndex, 4095);
      assertEquals(parts.eventIndex, 99);
    });

    it("parses Event ID with minimum values", () => {
      const eventId = createEventIdFromParts(0, 1, 1, 1);
      const parts = parseEventId(eventId);

      assertEquals(parts.ledgerSequence, 0);
      assertEquals(parts.transactionOrder, 1);
      assertEquals(parts.operationIndex, 1);
      assertEquals(parts.eventIndex, 0);
    });
  });

  describe("invalid Event IDs", () => {
    it("throws INVALID_EVENT_ID_FORMAT for empty string", () => {
      assertThrows(() => parseEventId(""), E.INVALID_EVENT_ID_FORMAT);
    });

    it("throws INVALID_EVENT_ID_FORMAT for malformed Event ID", () => {
      assertThrows(
        () => parseEventId("not-an-event-id"),
        E.INVALID_EVENT_ID_FORMAT
      );
    });

    it("throws INVALID_EVENT_ID_FORMAT for wrong format", () => {
      assertThrows(
        () => parseEventId("12345-67890"),
        E.INVALID_EVENT_ID_FORMAT
      );
    });

    it("throws INVALID_EVENT_ID_FORMAT for invalid TOID part", () => {
      assertThrows(
        () => parseEventId("9223372036854775808-0000000001"),
        E.INVALID_EVENT_ID_FORMAT
      );
    });
  });

  describe("roundtrip", () => {
    it("createEventIdFromParts -> parseEventId preserves values", () => {
      const ledger = 500;
      const tx = 20;
      const op = 5;
      const event = 3;

      const eventId = createEventIdFromParts(ledger, tx, op, event);
      const parsed = parseEventId(eventId);

      assertEquals(parsed.ledgerSequence, ledger);
      assertEquals(parsed.transactionOrder, tx);
      assertEquals(parsed.operationIndex, op);
      assertEquals(parsed.eventIndex, event - 1); // Output is 0-based
    });

    it("multiple roundtrips produce consistent results", () => {
      const eventId1 = createEventIdFromParts(999, 10, 3, 7);
      const parsed1 = parseEventId(eventId1);

      const eventId2 = createEventIdFromParts(
        parsed1.ledgerSequence,
        parsed1.transactionOrder,
        parsed1.operationIndex,
        parsed1.eventIndex + 1 // Convert back to 1-based
      );
      const parsed2 = parseEventId(eventId2);

      assertEquals(parsed1.ledgerSequence, parsed2.ledgerSequence);
      assertEquals(parsed1.transactionOrder, parsed2.transactionOrder);
      assertEquals(parsed1.operationIndex, parsed2.operationIndex);
      assertEquals(parsed1.eventIndex, parsed2.eventIndex);
    });
  });
});
