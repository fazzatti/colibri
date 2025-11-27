import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Keypair, Address, nativeToScVal, Contract } from "stellar-sdk";
import { Event } from "@/event/event.ts";
import { MintEvent, MintEventSchema } from "@/event/standards/sac/mint.ts";
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
  it("should have correct structure per CAP-0067", () => {
    assertEquals(MintEventSchema.name, "mint");
    assertEquals(MintEventSchema.topics.length, 2);
    assertEquals(MintEventSchema.topics[0].name, "to");
    assertEquals(MintEventSchema.topics[0].type, "address");
    assertEquals(MintEventSchema.topics[1].name, "asset");
    assertEquals(MintEventSchema.topics[1].type, "string");
    assertEquals(MintEventSchema.value.name, "amount");
    assertEquals(MintEventSchema.value.type, "i128");
  });
});

describe("MintEvent", () => {
  const assetString =
    "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

  describe("is()", () => {
    it("should return true for valid SAC mint event", () => {
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("mint"),
          new Address(to).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(MintEvent.is(event), true);
    });

    it("should return true for native asset mint", () => {
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("mint"),
          new Address(to).toScVal(),
          xdr.ScVal.scvString("native"),
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(MintEvent.is(event), true);
    });

    it("should return false for SEP-41 mint (no asset topic)", () => {
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint"), new Address(to).toScVal()],
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
          // missing asset topic
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
        [
          xdr.ScVal.scvSymbol("mint"),
          new Address(to).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(amount, { type: "i128" })
      );

      const mintEvent = MintEvent.fromEvent(event);

      assertExists(mintEvent);
      assertEquals(mintEvent.to, to);
      assertEquals(mintEvent.amount, amount);
      assertEquals(mintEvent.asset, assetString);
    });

    it("should throw for non-SAC mint event", () => {
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint"), new Address(to).toScVal()],
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
    it("should identify account addresses", () => {
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("mint"),
          new Address(to).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(100n, { type: "i128" })
      );

      const mintEvent = MintEvent.fromEvent(event);

      assertEquals(mintEvent.isToAccount(), true);
      assertEquals(mintEvent.isToContract(), false);
    });

    it("should identify contract addresses", () => {
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("mint"),
          new Address(contractId).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(100n, { type: "i128" })
      );

      const mintEvent = MintEvent.fromEvent(event);

      assertEquals(mintEvent.isToAccount(), false);
      assertEquals(mintEvent.isToContract(), true);
    });
  });

  describe("toTopicFilter()", () => {
    it("should create filter for any SAC mint event", () => {
      const filter = MintEvent.toTopicFilter({});

      assertEquals(filter.length, 3);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1], null);
      assertEquals(filter[2], null);
    });

    it("should create filter for mints to specific address", () => {
      const to = Keypair.random().publicKey();
      const filter = MintEvent.toTopicFilter({ to });

      assertEquals(filter.length, 3);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1]?.switch().name, "scvAddress");
      assertEquals(filter[2], null);
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
