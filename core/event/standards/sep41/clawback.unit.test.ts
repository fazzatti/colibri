import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Keypair, Address, nativeToScVal } from "stellar-sdk";
import { Event } from "@/event/event.ts";
import {
  ClawbackEvent,
  ClawbackEventSchema,
} from "@/event/standards/sep41/clawback.ts";
import { EventType } from "@/event/types.ts";
import type { ContractId } from "@/strkeys/types.ts";

// Helper to create a mock Event
function createMockEvent(
  topics: xdr.ScVal[],
  value: xdr.ScVal,
  contractId?: string
): Event {
  const contract =
    contractId ?? "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

  return new Event({
    id: "0000000000000000000-0000000000",
    type: EventType.Contract,
    ledger: 12345,
    ledgerClosedAt: "2024-01-01T00:00:00Z",
    transactionIndex: 0,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: "abc123",
    contractId: contract as ContractId,
    topic: topics,
    value: value,
  });
}

describe("ClawbackEventSchema", () => {
  it("should have correct structure per SEP-41", () => {
    assertEquals(ClawbackEventSchema.name, "clawback");
    assertEquals(ClawbackEventSchema.topics.length, 1);
    assertEquals(ClawbackEventSchema.topics[0].name, "from");
    assertEquals(ClawbackEventSchema.topics[0].type, "address");
    assertEquals(ClawbackEventSchema.value.name, "amount");
    assertEquals(ClawbackEventSchema.value.type, "i128");
  });
});

describe("ClawbackEvent", () => {
  describe("is()", () => {
    it("should return true for valid clawback event", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("clawback"), new Address(from).toScVal()],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(ClawbackEvent.is(event), true);
    });

    it("should return false for burn event", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("burn"), new Address(from).toScVal()],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(ClawbackEvent.is(event), false);
    });

    it("should return false for wrong number of topics", () => {
      const from = Keypair.random().publicKey();
      const extra = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("clawback"),
          new Address(from).toScVal(),
          new Address(extra).toScVal(), // extra topic
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(ClawbackEvent.is(event), false);
    });

    it("should return false for wrong topic type", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("clawback"), xdr.ScVal.scvU32(123)], // should be address
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(ClawbackEvent.is(event), false);
    });

    it("should return false for wrong value type", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("clawback"), new Address(from).toScVal()],
        xdr.ScVal.scvU32(100) // should be i128
      );

      assertEquals(ClawbackEvent.is(event), false);
    });
  });

  describe("fromEvent()", () => {
    it("should create ClawbackEvent with typed accessors", () => {
      const from = Keypair.random().publicKey();
      const amount = 5000000000n;
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("clawback"), new Address(from).toScVal()],
        nativeToScVal(amount, { type: "i128" })
      );

      const clawbackEvent = ClawbackEvent.fromEvent(event);

      assertExists(clawbackEvent);
      assertEquals(clawbackEvent.from, from);
      assertEquals(clawbackEvent.amount, amount);
    });

    it("should throw for non-clawback event", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint")],
        nativeToScVal(100n, { type: "i128" })
      );

      assertThrows(
        () => ClawbackEvent.fromEvent(event),
        Error,
        "does not match clawback schema"
      );
    });
  });

  describe("tryFromEvent()", () => {
    it("should return ClawbackEvent for valid event", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("clawback"), new Address(from).toScVal()],
        nativeToScVal(100n, { type: "i128" })
      );

      const result = ClawbackEvent.tryFromEvent(event);
      assertExists(result);
      assertEquals(result.from, from);
    });

    it("should return undefined for invalid event", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint")],
        nativeToScVal(100n, { type: "i128" })
      );

      assertEquals(ClawbackEvent.tryFromEvent(event), undefined);
    });
  });

  describe("address type checks", () => {
    it("should identify account address", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("clawback"), new Address(from).toScVal()],
        nativeToScVal(100n, { type: "i128" })
      );

      const clawbackEvent = ClawbackEvent.fromEvent(event);

      assertEquals(clawbackEvent.isFromAccount(), true);
      assertEquals(clawbackEvent.isFromContract(), false);
    });

    it("should identify contract address", () => {
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("clawback"), new Address(contractId).toScVal()],
        nativeToScVal(100n, { type: "i128" })
      );

      const clawbackEvent = ClawbackEvent.fromEvent(event);

      assertEquals(clawbackEvent.isFromAccount(), false);
      assertEquals(clawbackEvent.isFromContract(), true);
    });
  });

  describe("toTopicFilter()", () => {
    it("should create filter for any clawback event", () => {
      const filter = ClawbackEvent.toTopicFilter({});

      assertEquals(filter.length, 2);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals(filter[1], "*");
    });

    it("should create filter for clawbacks from specific address", () => {
      const from = Keypair.random().publicKey();
      const filter = ClawbackEvent.toTopicFilter({ from });

      assertEquals(filter.length, 2);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals((filter[1] as xdr.ScVal).switch().name, "scvAddress");
    });
  });
});
