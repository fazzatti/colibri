import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Keypair, Address, nativeToScVal } from "stellar-sdk";
import { Event } from "@/event/event.ts";
import { BurnEvent, BurnEventSchema } from "@/event/standards/sep41/burn.ts";
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

describe("BurnEventSchema", () => {
  it("should have correct structure per SEP-41", () => {
    assertEquals(BurnEventSchema.name, "burn");
    assertEquals(BurnEventSchema.topics.length, 1);
    assertEquals(BurnEventSchema.topics[0].name, "from");
    assertEquals(BurnEventSchema.topics[0].type, "address");
    assertEquals(BurnEventSchema.value.name, "amount");
    assertEquals(BurnEventSchema.value.type, "i128");
  });
});

describe("BurnEvent", () => {
  describe("is()", () => {
    it("should return true for valid burn event", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("burn"), new Address(from).toScVal()],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(BurnEvent.is(event), true);
    });

    it("should return false for transfer event", () => {
      const from = Keypair.random().publicKey();
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("transfer"),
          new Address(from).toScVal(),
          new Address(to).toScVal(),
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(BurnEvent.is(event), false);
    });

    it("should return false for wrong number of topics", () => {
      const from = Keypair.random().publicKey();
      const extra = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("burn"),
          new Address(from).toScVal(),
          new Address(extra).toScVal(), // extra topic
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(BurnEvent.is(event), false);
    });

    it("should return false for wrong topic type", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("burn"), xdr.ScVal.scvU32(123)], // should be address
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(BurnEvent.is(event), false);
    });

    it("should return false for wrong value type", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("burn"), new Address(from).toScVal()],
        xdr.ScVal.scvU32(100) // should be i128
      );

      assertEquals(BurnEvent.is(event), false);
    });
  });

  describe("fromEvent()", () => {
    it("should create BurnEvent with typed accessors", () => {
      const from = Keypair.random().publicKey();
      const amount = 5000000000n;
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("burn"), new Address(from).toScVal()],
        nativeToScVal(amount, { type: "i128" })
      );

      const burnEvent = BurnEvent.fromEvent(event);

      assertExists(burnEvent);
      assertEquals(burnEvent.from, from);
      assertEquals(burnEvent.amount, amount);
    });

    it("should throw for non-burn event", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint")],
        nativeToScVal(100n, { type: "i128" })
      );

      assertThrows(
        () => BurnEvent.fromEvent(event),
        Error,
        "does not match burn schema"
      );
    });
  });

  describe("tryFromEvent()", () => {
    it("should return BurnEvent for valid event", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("burn"), new Address(from).toScVal()],
        nativeToScVal(100n, { type: "i128" })
      );

      const result = BurnEvent.tryFromEvent(event);
      assertExists(result);
      assertEquals(result.from, from);
    });

    it("should return undefined for invalid event", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint")],
        nativeToScVal(100n, { type: "i128" })
      );

      assertEquals(BurnEvent.tryFromEvent(event), undefined);
    });
  });

  describe("address type checks", () => {
    it("should identify account address", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("burn"), new Address(from).toScVal()],
        nativeToScVal(100n, { type: "i128" })
      );

      const burnEvent = BurnEvent.fromEvent(event);

      assertEquals(burnEvent.isFromAccount(), true);
      assertEquals(burnEvent.isFromContract(), false);
    });

    it("should identify contract address", () => {
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("burn"), new Address(contractId).toScVal()],
        nativeToScVal(100n, { type: "i128" })
      );

      const burnEvent = BurnEvent.fromEvent(event);

      assertEquals(burnEvent.isFromAccount(), false);
      assertEquals(burnEvent.isFromContract(), true);
    });
  });

  describe("toTopicFilter()", () => {
    it("should create filter for any burn event", () => {
      const filter = BurnEvent.toTopicFilter({});

      assertEquals(filter.length, 2);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1], null);
    });

    it("should create filter for burns from specific address", () => {
      const from = Keypair.random().publicKey();
      const filter = BurnEvent.toTopicFilter({ from });

      assertEquals(filter.length, 2);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1]?.switch().name, "scvAddress");
    });
  });
});
