import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Keypair, Address, nativeToScVal } from "stellar-sdk";
import { Event } from "@/event/event.ts";
import {
  ClawbackEvent,
  ClawbackEventSchema,
} from "@/event/standards/sac/clawback.ts";
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

describe("ClawbackEventSchema", () => {
  it("should have correct structure per CAP-0067", () => {
    assertEquals(ClawbackEventSchema.name, "clawback");
    assertEquals(ClawbackEventSchema.topics.length, 2);
    assertEquals(ClawbackEventSchema.topics[0].name, "from");
    assertEquals(ClawbackEventSchema.topics[0].type, "address");
    assertEquals(ClawbackEventSchema.topics[1].name, "asset");
    assertEquals(ClawbackEventSchema.topics[1].type, "string");
    assertEquals(ClawbackEventSchema.value.name, "amount");
    assertEquals(ClawbackEventSchema.value.type, "i128");
  });
});

describe("ClawbackEvent", () => {
  describe("is()", () => {
    it("should return true for valid SAC clawback event", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("clawback"),
          new Address(from).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(ClawbackEvent.is(event), true);
    });

    it("should return true for native asset clawback", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("clawback"),
          new Address(from).toScVal(),
          xdr.ScVal.scvString("native"),
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(ClawbackEvent.is(event), true);
    });

    it("should return false for SEP-41 clawback (no asset topic)", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("clawback"), new Address(from).toScVal()],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(ClawbackEvent.is(event), false);
    });

    it("should return false for wrong number of topics", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("clawback"),
          new Address(from).toScVal(),
          // missing asset topic
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(ClawbackEvent.is(event), false);
    });
  });

  describe("fromEvent()", () => {
    it("should create ClawbackEvent with typed accessors", () => {
      const from = Keypair.random().publicKey();
      const amount = 5000000000n;
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("clawback"),
          new Address(from).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(amount, { type: "i128" })
      );

      const clawbackEvent = ClawbackEvent.fromEvent(event);

      assertExists(clawbackEvent);
      assertEquals(clawbackEvent.from, from);
      assertEquals(clawbackEvent.amount, amount);
      assertEquals(clawbackEvent.asset, assetString);
    });

    it("should throw for invalid SEP-11 asset format", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("clawback"),
          new Address(from).toScVal(),
          xdr.ScVal.scvString("invalid-asset"),
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      const clawbackEvent = ClawbackEvent.fromEvent(event);
      assertThrows(
        () => clawbackEvent.asset,
        Error,
        "Invalid SEP-11 asset format: invalid-asset"
      );
    });
  });

  describe("address type checks", () => {
    it("should identify account addresses", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("clawback"),
          new Address(from).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(100n, { type: "i128" })
      );

      const clawbackEvent = ClawbackEvent.fromEvent(event);

      assertEquals(clawbackEvent.isFromAccount(), true);
      assertEquals(clawbackEvent.isFromContract(), false);
    });

    it("should identify contract addresses", () => {
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("clawback"),
          new Address(contractId).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(100n, { type: "i128" })
      );

      const clawbackEvent = ClawbackEvent.fromEvent(event);

      assertEquals(clawbackEvent.isFromAccount(), false);
      assertEquals(clawbackEvent.isFromContract(), true);
    });
  });

  describe("toTopicFilter()", () => {
    it("should create filter for any SAC clawback event", () => {
      const filter = ClawbackEvent.toTopicFilter({});

      assertEquals(filter.length, 3);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals(filter[1], "*");
      assertEquals(filter[2], "*");
    });

    it("should create filter for clawbacks from specific address", () => {
      const from = Keypair.random().publicKey();
      const filter = ClawbackEvent.toTopicFilter({ from });

      assertEquals(filter.length, 3);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals((filter[1] as xdr.ScVal).switch().name, "scvAddress");
      assertEquals(filter[2], "*");
    });
  });
});
