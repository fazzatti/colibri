import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Keypair, Address, nativeToScVal } from "stellar-sdk";
import { Event } from "@/event/event.ts";
import {
  ApproveEvent,
  ApproveEventSchema,
} from "@/event/standards/sep41/approve.ts";
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

describe("ApproveEventSchema", () => {
  it("should have correct structure per SEP-41", () => {
    assertEquals(ApproveEventSchema.name, "approve");
    assertEquals(ApproveEventSchema.topics.length, 2);
    assertEquals(ApproveEventSchema.topics[0].name, "from");
    assertEquals(ApproveEventSchema.topics[0].type, "address");
    assertEquals(ApproveEventSchema.topics[1].name, "spender");
    assertEquals(ApproveEventSchema.topics[1].type, "address");
    assertEquals(ApproveEventSchema.value.name, "data");
    assertEquals(ApproveEventSchema.value.type, "vec");
  });
});

describe("ApproveEvent", () => {
  describe("is()", () => {
    it("should return true for valid approve event", () => {
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

      assertEquals(ApproveEvent.is(event), true);
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

      assertEquals(ApproveEvent.is(event), false);
    });

    it("should return false for wrong number of topics", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("approve"), new Address(from).toScVal()],
        xdr.ScVal.scvVec([
          nativeToScVal(1000000n, { type: "i128" }),
          xdr.ScVal.scvU32(50000),
        ])
      );

      assertEquals(ApproveEvent.is(event), false);
    });

    it("should return false for wrong value type", () => {
      const from = Keypair.random().publicKey();
      const spender = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("approve"),
          new Address(from).toScVal(),
          new Address(spender).toScVal(),
        ],
        nativeToScVal(1000000n, { type: "i128" }) // should be vec
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
    });

    it("should throw for non-approve event", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("burn")],
        nativeToScVal(100n, { type: "i128" })
      );

      assertThrows(
        () => ApproveEvent.fromEvent(event),
        Error,
        "does not match approve schema"
      );
    });
  });

  describe("tryFromEvent()", () => {
    it("should return ApproveEvent for valid event", () => {
      const from = Keypair.random().publicKey();
      const spender = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("approve"),
          new Address(from).toScVal(),
          new Address(spender).toScVal(),
        ],
        xdr.ScVal.scvVec([
          nativeToScVal(100n, { type: "i128" }),
          xdr.ScVal.scvU32(50000),
        ])
      );

      const result = ApproveEvent.tryFromEvent(event);
      assertExists(result);
      assertEquals(result.from, from);
    });

    it("should return undefined for invalid event", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint")],
        nativeToScVal(100n, { type: "i128" })
      );

      assertEquals(ApproveEvent.tryFromEvent(event), undefined);
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
    it("should create filter for any approve event", () => {
      const filter = ApproveEvent.toTopicFilter({});

      assertEquals(filter.length, 3);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals(filter[1], "*");
      assertEquals(filter[2], "*");
    });

    it("should create filter for approvals from specific address", () => {
      const from = Keypair.random().publicKey();
      const filter = ApproveEvent.toTopicFilter({ from });

      assertEquals(filter.length, 3);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals((filter[1] as xdr.ScVal).switch().name, "scvAddress");
      assertEquals(filter[2], "*");
    });

    it("should create filter for approvals to specific spender", () => {
      const spender = Keypair.random().publicKey();
      const filter = ApproveEvent.toTopicFilter({ spender });

      assertEquals(filter.length, 3);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals(filter[1], "*");
      assertEquals((filter[2] as xdr.ScVal).switch().name, "scvAddress");
    });

    it("should create filter with both from and spender", () => {
      const from = Keypair.random().publicKey();
      const spender = Keypair.random().publicKey();
      const filter = ApproveEvent.toTopicFilter({ from, spender });

      assertEquals(filter.length, 3);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals((filter[1] as xdr.ScVal).switch().name, "scvAddress");
      assertEquals((filter[2] as xdr.ScVal).switch().name, "scvAddress");
    });
  });
});
