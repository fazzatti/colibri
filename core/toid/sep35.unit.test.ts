import { createEventId, parseEventId } from "@/event/event-id/index.ts";
import { assertEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  createSep35OperationId,
  createTOID,
  parseSep35OperationId,
  parseTOID,
} from "@/toid/index.ts";
import * as ERROR from "@/toid/error.ts";
const { describe, it } = recordColibriTests(import.meta.url);
describe("separate SEP-35 operation identifiers", () => {
  it("packs the one-based operation index and preserves historical RPC IDs", () => {
    assertEquals(createSep35OperationId(1, 1, 1), "0000000004294971393");
    assertEquals(parseSep35OperationId("4294971393"), {
      ledgerSequence: 1,
      transactionOrder: 1,
      operationIndex: 1,
    });
    assertEquals(createTOID(1, 1, 1), "0000000004294971392");
    const legacy = createEventId(createTOID(1, 1, 1), 1);
    assertEquals(legacy, "0000000004294971392-0000000000");
    assertEquals(parseEventId(legacy), {
      ledgerSequence: 1,
      transactionOrder: 1,
      operationIndex: 1,
      eventIndex: 0,
    });
    assertEquals(parseTOID("4294971392"), {
      ledgerSequence: 1,
      transactionOrder: 1,
      operationIndex: 1,
    });
    assertEquals(
      createSep35OperationId(2147483647, 1048575, 4095),
      "9223372036854775807",
    );
    assertEquals(parseSep35OperationId("9223372036854775807"), {
      ledgerSequence: 2147483647,
      transactionOrder: 1048575,
      operationIndex: 4095,
    });
  });
  it("rejects noninteger components and reserved operation IDs with typed errors", () => {
    for (const invalid of [NaN, Infinity, -1, 1.5]) {
      assertThrows(
        () => createSep35OperationId(invalid, 1, 1),
        ERROR.LEDGER_OUT_OF_RANGE,
      );
      assertThrows(
        () => createSep35OperationId(1, invalid, 1),
        ERROR.TX_ORDER_OUT_OF_RANGE,
      );
      assertThrows(
        () => createSep35OperationId(1, 1, invalid),
        ERROR.OP_INDEX_OUT_OF_RANGE,
      );
    }
    for (
      const invalid of [
        "4294971393\n",
        " 4294971393",
        "+4294971393",
        "0x100001001",
        "-1",
        "9223372036854775808",
        "0",
        "4294971392",
        "4294967297",
        "no",
      ]
    ) assertThrows(() => parseSep35OperationId(invalid), ERROR.INVALID_TOID);
  });
});
