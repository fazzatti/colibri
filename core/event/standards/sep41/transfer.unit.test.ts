import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Keypair, Address, nativeToScVal } from "stellar-sdk";
import { Event } from "@/event/event.ts";
import {
  TransferEvent,
  TransferEventSchema,
} from "@/event/standards/sep41/transfer.ts";
import { EventType } from "@/event/types.ts";
import { isEventMuxedData } from "@/event/standards/cap67/index.ts";
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

describe("TransferEventSchema", () => {
  it("should have correct structure per SEP-41", () => {
    assertEquals(TransferEventSchema.name, "transfer");
    assertEquals(TransferEventSchema.topics.length, 2);
    assertEquals(TransferEventSchema.topics[0].name, "from");
    assertEquals(TransferEventSchema.topics[0].type, "address");
    assertEquals(TransferEventSchema.topics[1].name, "to");
    assertEquals(TransferEventSchema.topics[1].type, "address");
    assertEquals(TransferEventSchema.value.name, "amount");
    assertEquals(TransferEventSchema.value.type, "i128");
  });
});

describe("TransferEvent", () => {
  describe("is()", () => {
    it("should return true for valid transfer event", () => {
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

      assertEquals(TransferEvent.is(event), true);
    });

    it("should return false for mint event", () => {
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint"), new Address(to).toScVal()],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(TransferEvent.is(event), false);
    });

    it("should return false for wrong number of topics", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("transfer"), new Address(from).toScVal()],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(TransferEvent.is(event), false);
    });

    it("should return false for wrong topic type", () => {
      const from = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("transfer"),
          new Address(from).toScVal(),
          xdr.ScVal.scvU32(123), // should be address
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(TransferEvent.is(event), false);
    });
  });

  describe("fromEvent()", () => {
    it("should create TransferEvent with typed accessors", () => {
      const from = Keypair.random().publicKey();
      const to = Keypair.random().publicKey();
      const amount = 5000000000n;
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("transfer"),
          new Address(from).toScVal(),
          new Address(to).toScVal(),
        ],
        nativeToScVal(amount, { type: "i128" })
      );

      const transferEvent = TransferEvent.fromEvent(event);

      assertExists(transferEvent);
      assertEquals(transferEvent.from, from);
      assertEquals(transferEvent.to, to);
      assertEquals(transferEvent.amount, amount);
    });

    it("should throw for non-transfer event", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("burn")],
        nativeToScVal(100n, { type: "i128" })
      );

      assertThrows(
        () => TransferEvent.fromEvent(event),
        Error,
        "does not match transfer schema"
      );
    });
  });

  describe("tryFromEvent()", () => {
    it("should return TransferEvent for valid event", () => {
      const from = Keypair.random().publicKey();
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("transfer"),
          new Address(from).toScVal(),
          new Address(to).toScVal(),
        ],
        nativeToScVal(100n, { type: "i128" })
      );

      const result = TransferEvent.tryFromEvent(event);
      assertExists(result);
      assertEquals(result.from, from);
    });

    it("should return undefined for invalid event", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("mint")],
        nativeToScVal(100n, { type: "i128" })
      );

      assertEquals(TransferEvent.tryFromEvent(event), undefined);
    });
  });

  describe("address type checks", () => {
    it("should identify account addresses", () => {
      const from = Keypair.random().publicKey();
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("transfer"),
          new Address(from).toScVal(),
          new Address(to).toScVal(),
        ],
        nativeToScVal(100n, { type: "i128" })
      );

      const transferEvent = TransferEvent.fromEvent(event);

      assertEquals(transferEvent.isFromAccount(), true);
      assertEquals(transferEvent.isFromContract(), false);
      assertEquals(transferEvent.isToAccount(), true);
      assertEquals(transferEvent.isToContract(), false);
    });

    it("should identify contract addresses", () => {
      const contractId =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("transfer"),
          new Address(contractId).toScVal(),
          new Address(to).toScVal(),
        ],
        nativeToScVal(100n, { type: "i128" })
      );

      const transferEvent = TransferEvent.fromEvent(event);

      assertEquals(transferEvent.isFromAccount(), false);
      assertEquals(transferEvent.isFromContract(), true);
    });
  });

  describe("muxed data handling", () => {
    it("should return no muxed ID for simple value", () => {
      const from = Keypair.random().publicKey();
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("transfer"),
          new Address(from).toScVal(),
          new Address(to).toScVal(),
        ],
        nativeToScVal(100n, { type: "i128" })
      );

      const transferEvent = TransferEvent.fromEvent(event);

      assertEquals(transferEvent.hasMuxedId(), false);
      assertEquals(transferEvent.toMuxedId, undefined);
    });

    it("should get amount from muxed data structure", () => {
      const from = Keypair.random().publicKey();
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("transfer"),
          new Address(from).toScVal(),
          new Address(to).toScVal(),
        ],
        nativeToScVal(5000n, { type: "i128" })
      );

      const transferEvent = TransferEvent.fromEvent(event);

      // Override the value getter to simulate muxed data
      Object.defineProperty(transferEvent, "value", {
        get: () => ({ amount: 5000n, to_muxed_id: 12345n }),
      });

      assertEquals(transferEvent.amount, 5000n);
      assertEquals(transferEvent.toMuxedId, 12345n);
      assertEquals(transferEvent.hasMuxedId(), true);
    });

    it("should throw for invalid data format (not bigint and not muxed)", () => {
      const from = Keypair.random().publicKey();
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("transfer"),
          new Address(from).toScVal(),
          new Address(to).toScVal(),
        ],
        nativeToScVal(1000n, { type: "i128" })
      );

      const transferEvent = TransferEvent.fromEvent(event);

      // Override the value getter to simulate invalid data format
      Object.defineProperty(transferEvent, "value", {
        get: () => ["invalid"],
      });

      assertThrows(
        () => transferEvent.amount,
        Error,
        "Invalid transfer event data format"
      );
    });
  });

  describe("toTopicFilter()", () => {
    it("should create filter for any transfer event", () => {
      const filter = TransferEvent.toTopicFilter({});

      assertEquals(filter.length, 3);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1], null);
      assertEquals(filter[2], null);
    });

    it("should create filter for transfers from specific address", () => {
      const from = Keypair.random().publicKey();
      const filter = TransferEvent.toTopicFilter({ from });

      assertEquals(filter.length, 3);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1]?.switch().name, "scvAddress");
      assertEquals(filter[2], null);
    });

    it("should create filter for transfers to specific address", () => {
      const to = Keypair.random().publicKey();
      const filter = TransferEvent.toTopicFilter({ to });

      assertEquals(filter.length, 3);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1], null);
      assertEquals(filter[2]?.switch().name, "scvAddress");
    });

    it("should create filter with both from and to", () => {
      const from = Keypair.random().publicKey();
      const to = Keypair.random().publicKey();
      const filter = TransferEvent.toTopicFilter({ from, to });

      assertEquals(filter.length, 3);
      assertEquals(filter[0]?.switch().name, "scvSymbol");
      assertEquals(filter[1]?.switch().name, "scvAddress");
      assertEquals(filter[2]?.switch().name, "scvAddress");
    });
  });
});

describe("isTransferMuxedData", () => {
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
