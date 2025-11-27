import { assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Keypair, Address, nativeToScVal } from "stellar-sdk";
import { Event } from "@/event/event.ts";
import { BurnEvent, BurnEventSchema } from "@/event/standards/sac/burn.ts";
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

const assetString =
  "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("BurnEventSchema", () => {
  it("should have correct structure per CAP-0046-06", () => {
    assertEquals(BurnEventSchema.name, "burn");
    assertEquals(BurnEventSchema.topics.length, 2);
    assertEquals(BurnEventSchema.topics[0].name, "from");
    assertEquals(BurnEventSchema.topics[0].type, "address");
    assertEquals(BurnEventSchema.topics[1].name, "asset");
    assertEquals(BurnEventSchema.topics[1].type, "string");
    assertEquals(BurnEventSchema.value.name, "amount");
    assertEquals(BurnEventSchema.value.type, "i128");
  });
});

describe("BurnEvent", () => {
  describe("is()", () => {
    it("should return true for valid SAC burn event", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("burn"),
          new Address(from).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(BurnEvent.is(event), true);
    });

    it("should return true for native asset burn", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("burn"),
          new Address(from).toScVal(),
          xdr.ScVal.scvString("native"),
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(BurnEvent.is(event), true);
    });

    it("should return false for SEP-41 burn (no asset topic)", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("burn"), new Address(from).toScVal()],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(BurnEvent.is(event), false);
    });

    it("should return false for wrong number of topics", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("burn"),
          new Address(from).toScVal(),
          // missing asset topic
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(BurnEvent.is(event), false);
    });
  });

  describe("fromEvent()", () => {
    it("should create BurnEvent with typed accessors", () => {
      const from = Keypair.random().publicKey();
      const amount = 5000000000n;
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("burn"),
          new Address(from).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(amount, { type: "i128" })
      );

      const burnEvent = BurnEvent.fromEvent(event);

      assertExists(burnEvent);
      assertEquals(burnEvent.from, from);
      assertEquals(burnEvent.amount, amount);
      assertEquals(burnEvent.asset, assetString);
    });
  });

  describe("address type checks", () => {
    it("should identify account addresses", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("burn"),
          new Address(from).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(100n, { type: "i128" })
      );

      const burnEvent = BurnEvent.fromEvent(event);

      assertEquals(burnEvent.isFromAccount(), true);
      assertEquals(burnEvent.isFromContract(), false);
    });

    it("should identify contract addresses", () => {
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("burn"),
          new Address(contractId).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(100n, { type: "i128" })
      );

      const burnEvent = BurnEvent.fromEvent(event);

      assertEquals(burnEvent.isFromAccount(), false);
      assertEquals(burnEvent.isFromContract(), true);
    });
  });

  describe("toTopicFilter()", () => {
    it("should create filter for any SAC burn event", () => {
      const filter = BurnEvent.toTopicFilter({});

      assertEquals(filter.length, 3);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1], null);
      assertEquals(filter[2], null);
    });

    it("should create filter for burns from specific address", () => {
      const from = Keypair.random().publicKey();
      const filter = BurnEvent.toTopicFilter({ from });

      assertEquals(filter.length, 3);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1]?.switch().name, "scvAddress");
      assertEquals(filter[2], null);
    });
  });
});
