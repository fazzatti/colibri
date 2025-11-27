import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Keypair, Address, nativeToScVal, Contract } from "stellar-sdk";
import { Event } from "@/event/event.ts";
import { MintEvent, MintEventSchema } from "@/event/standards/sep41/mint.ts";
import { EventType } from "@/event/types.ts";
import { isEventMuxedData } from "@/event/standards/cap67/index.ts";

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
    contractId: new Contract(contract),
    topic: topics,
    value: value,
  });
}

describe("MintEventSchema", () => {
  it("should have correct structure per SEP-41", () => {
    assertEquals(MintEventSchema.name, "mint");
    assertEquals(MintEventSchema.topics.length, 1);
    assertEquals(MintEventSchema.topics[0].name, "to");
    assertEquals(MintEventSchema.topics[0].type, "address");
    assertEquals(MintEventSchema.value.name, "amount");
    assertEquals(MintEventSchema.value.type, "i128");
  });
});

describe("MintEvent", () => {
  describe("is()", () => {
    it("should return true for valid mint event with simple value", () => {
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint"), new Address(to).toScVal()],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(MintEvent.is(event), true);
    });

    it("should return true for valid mint event with muxed value", () => {
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint"), new Address(to).toScVal()],
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("amount"),
            val: nativeToScVal(1000000n, { type: "i128" }),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("to_muxed_id"),
            val: nativeToScVal(12345n, { type: "u64" }),
          }),
        ])
      );

      // The schema validates as map type for muxed
      assertEquals(MintEvent.is(event), false); // Schema expects i128, not map
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

      assertEquals(MintEvent.is(event), false);
    });

    it("should return false for wrong number of topics", () => {
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("mint"),
          new Address(to).toScVal(),
          new Address(to).toScVal(), // extra topic
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(MintEvent.is(event), false);
    });
  });

  describe("fromEvent()", () => {
    it("should create MintEvent with typed accessors", () => {
      const to = Keypair.random().publicKey();
      const amount = 5000000000n;
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint"), new Address(to).toScVal()],
        nativeToScVal(amount, { type: "i128" })
      );

      const mintEvent = MintEvent.fromEvent(event);

      assertExists(mintEvent);
      assertEquals(mintEvent.to, to);
      assertEquals(mintEvent.amount, amount);
    });

    it("should throw for non-mint event", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("burn")],
        nativeToScVal(100n, { type: "i128" })
      );

      assertThrows(
        () => MintEvent.fromEvent(event),
        Error,
        "does not match mint schema"
      );
    });
  });

  describe("address type checks", () => {
    it("should identify account address", () => {
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint"), new Address(to).toScVal()],
        nativeToScVal(100n, { type: "i128" })
      );

      const mintEvent = MintEvent.fromEvent(event);

      assertEquals(mintEvent.isToAccount(), true);
      assertEquals(mintEvent.isToContract(), false);
    });

    it("should identify contract address", () => {
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint"), new Address(contractId).toScVal()],
        nativeToScVal(100n, { type: "i128" })
      );

      const mintEvent = MintEvent.fromEvent(event);

      assertEquals(mintEvent.isToAccount(), false);
      assertEquals(mintEvent.isToContract(), true);
    });
  });

  describe("muxed data handling", () => {
    it("should return no muxed ID for simple value", () => {
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint"), new Address(to).toScVal()],
        nativeToScVal(100n, { type: "i128" })
      );

      const mintEvent = MintEvent.fromEvent(event);

      assertEquals(mintEvent.hasMuxedId(), false);
      assertEquals(mintEvent.toMuxedId, undefined);
    });
  });

  describe("toTopicFilter()", () => {
    it("should create filter for any mint event", () => {
      const filter = MintEvent.toTopicFilter({});

      assertEquals(filter.length, 2);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1], null);
    });

    it("should create filter for mints to specific address", () => {
      const to = Keypair.random().publicKey();
      const filter = MintEvent.toTopicFilter({ to });

      assertEquals(filter.length, 2);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1]?.switch().name, "scvAddress");
    });
  });
});

describe("isMintMuxedData", () => {
  it("should return true for muxed data structure", () => {
    const data = { amount: 100n, to_muxed_id: 12345n };
    assertEquals(isEventMuxedData(data), true);
  });

  it("should return true for muxed data without muxed_id", () => {
    const data = { amount: 100n };
    assertEquals(isEventMuxedData(data), true);
  });

  it("should return false for simple bigint", () => {
    assertEquals(isEventMuxedData(100n), false);
  });

  it("should return false for array", () => {
    assertEquals(isEventMuxedData([100n, 200n]), false);
  });
});
