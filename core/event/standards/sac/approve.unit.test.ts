import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Keypair, Address, nativeToScVal } from "stellar-sdk";
import { Event } from "@/event/event.ts";
import {
  ApproveEvent,
  ApproveEventSchema,
} from "@/event/standards/sac/approve.ts";
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

describe("ApproveEventSchema", () => {
  it("should have correct structure per CAP-0046-06", () => {
    assertEquals(ApproveEventSchema.name, "approve");
    assertEquals(ApproveEventSchema.topics.length, 3);
    assertEquals(ApproveEventSchema.topics[0].name, "from");
    assertEquals(ApproveEventSchema.topics[0].type, "address");
    assertEquals(ApproveEventSchema.topics[1].name, "spender");
    assertEquals(ApproveEventSchema.topics[1].type, "address");
    assertEquals(ApproveEventSchema.topics[2].name, "asset");
    assertEquals(ApproveEventSchema.topics[2].type, "string");
    assertEquals(ApproveEventSchema.value.name, "data");
    assertEquals(ApproveEventSchema.value.type, "vec");
  });
});

describe("ApproveEvent", () => {
  describe("is()", () => {
    it("should return true for valid SAC approve event", () => {
      const from = Keypair.random().publicKey();
      const spender = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("approve"),
          new Address(from).toScVal(),
          new Address(spender).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        xdr.ScVal.scvVec([
          nativeToScVal(1000000n, { type: "i128" }),
          xdr.ScVal.scvU32(50000),
        ])
      );

      assertEquals(ApproveEvent.is(event), true);
    });

    it("should return true for native asset approve", () => {
      const from = Keypair.random().publicKey();
      const spender = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("approve"),
          new Address(from).toScVal(),
          new Address(spender).toScVal(),
          xdr.ScVal.scvString("native"),
        ],
        xdr.ScVal.scvVec([
          nativeToScVal(1000000n, { type: "i128" }),
          xdr.ScVal.scvU32(50000),
        ])
      );

      assertEquals(ApproveEvent.is(event), true);
    });

    it("should return false for SEP-41 approve (no asset topic)", () => {
      const from = Keypair.random().publicKey();
      const spender = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("approve"),
          new Address(from).toScVal(),
          new Address(spender).toScVal(),
        ],
        xdr.ScVal.scvVec([
          nativeToScVal(1000000n, { type: "i128" }),
          xdr.ScVal.scvU32(50000),
        ])
      );

      assertEquals(ApproveEvent.is(event), false);
    });

    it("should return false for wrong number of topics", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("approve"),
          new Address(from).toScVal(),
          // missing spender and asset topics
        ],
        xdr.ScVal.scvVec([
          nativeToScVal(1000000n, { type: "i128" }),
          xdr.ScVal.scvU32(50000),
        ])
      );

      assertEquals(ApproveEvent.is(event), false);
    });
  });

  describe("fromEvent()", () => {
    it("should create ApproveEvent with typed accessors", () => {
      const from = Keypair.random().publicKey();
      const spender = Keypair.random().publicKey();
      const amount = 5000000000n;
      const liveUntilLedger = 100000;
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("approve"),
          new Address(from).toScVal(),
          new Address(spender).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        xdr.ScVal.scvVec([
          nativeToScVal(amount, { type: "i128" }),
          xdr.ScVal.scvU32(liveUntilLedger),
        ])
      );

      const approveEvent = ApproveEvent.fromEvent(event);

      assertExists(approveEvent);
      assertEquals(approveEvent.from, from);
      assertEquals(approveEvent.spender, spender);
      assertEquals(approveEvent.amount, amount);
      assertEquals(approveEvent.liveUntilLedger, liveUntilLedger);
      assertEquals(approveEvent.asset, assetString);
    });

    it("should throw for invalid SEP-11 asset format", () => {
      const from = Keypair.random().publicKey();
      const spender = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("approve"),
          new Address(from).toScVal(),
          new Address(spender).toScVal(),
          xdr.ScVal.scvString("invalid-asset"),
        ],
        xdr.ScVal.scvVec([
          nativeToScVal(1000000n, { type: "i128" }),
          xdr.ScVal.scvU32(50000),
        ])
      );

      const approveEvent = ApproveEvent.fromEvent(event);
      assertThrows(
        () => approveEvent.asset,
        Error,
        "Invalid SEP-11 asset format: invalid-asset"
      );
    });
  });

  describe("address type checks", () => {
    it("should identify account addresses", () => {
      const from = Keypair.random().publicKey();
      const spender = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("approve"),
          new Address(from).toScVal(),
          new Address(spender).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        xdr.ScVal.scvVec([
          nativeToScVal(100n, { type: "i128" }),
          xdr.ScVal.scvU32(50000),
        ])
      );

      const approveEvent = ApproveEvent.fromEvent(event);

      assertEquals(approveEvent.isFromAccount(), true);
      assertEquals(approveEvent.isFromContract(), false);
      assertEquals(approveEvent.isSpenderAccount(), true);
      assertEquals(approveEvent.isSpenderContract(), false);
    });

    it("should identify contract addresses", () => {
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const spender = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("approve"),
          new Address(contractId).toScVal(),
          new Address(spender).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        xdr.ScVal.scvVec([
          nativeToScVal(100n, { type: "i128" }),
          xdr.ScVal.scvU32(50000),
        ])
      );

      const approveEvent = ApproveEvent.fromEvent(event);

      assertEquals(approveEvent.isFromAccount(), false);
      assertEquals(approveEvent.isFromContract(), true);
    });
  });

  describe("toTopicFilter()", () => {
    it("should create filter for any SAC approve event", () => {
      const filter = ApproveEvent.toTopicFilter({});

      assertEquals(filter.length, 4);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals(filter[1], "*");
      assertEquals(filter[2], "*");
      assertEquals(filter[3], "*");
    });

    it("should create filter for approvals from specific address", () => {
      const from = Keypair.random().publicKey();
      const filter = ApproveEvent.toTopicFilter({ from });

      assertEquals(filter.length, 4);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals((filter[1] as xdr.ScVal).switch().name, "scvAddress");
      assertEquals(filter[2], "*");
      assertEquals(filter[3], "*");
    });

    it("should create filter for approvals to specific spender", () => {
      const spender = Keypair.random().publicKey();
      const filter = ApproveEvent.toTopicFilter({ spender });

      assertEquals(filter.length, 4);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals(filter[1], "*");
      assertEquals((filter[2] as xdr.ScVal).switch().name, "scvAddress");
      assertEquals(filter[3], "*");
    });
  });
});
