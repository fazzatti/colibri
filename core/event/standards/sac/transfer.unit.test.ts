import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr, Keypair, Address, nativeToScVal } from "stellar-sdk";
import { Event } from "@/event/event.ts";
import {
  TransferEvent,
  TransferEventSchema,
} from "@/event/standards/sac/transfer.ts";
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
  it("should have correct structure per CAP-0046-06", () => {
    assertEquals(TransferEventSchema.name, "transfer");
    assertEquals(TransferEventSchema.topics.length, 3);
    assertEquals(TransferEventSchema.topics[0].name, "from");
    assertEquals(TransferEventSchema.topics[0].type, "address");
    assertEquals(TransferEventSchema.topics[1].name, "to");
    assertEquals(TransferEventSchema.topics[1].type, "address");
    assertEquals(TransferEventSchema.topics[2].name, "asset");
    assertEquals(TransferEventSchema.topics[2].type, "string");
    assertEquals(TransferEventSchema.value.name, "amount");
    assertEquals(TransferEventSchema.value.type, "i128");
  });
});

describe("TransferEvent", () => {
  const assetString =
    "KALE:GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHTTV7DME7KALE";

  describe("is()", () => {
    it("should return true for valid SAC transfer event", () => {
      const from = Keypair.random().publicKey();
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("transfer"),
          new Address(from).toScVal(),
          new Address(to).toScVal(),
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(TransferEvent.is(event), true);
    });

    it("should return true for native asset transfer", () => {
      const from = Keypair.random().publicKey();
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("transfer"),
          new Address(from).toScVal(),
          new Address(to).toScVal(),
          xdr.ScVal.scvString("native"),
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(TransferEvent.is(event), true);
    });

    it("should return false for SEP-41 transfer (no asset topic)", () => {
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
          xdr.ScVal.scvString(assetString),
        ],
        nativeToScVal(amount, { type: "i128" })
      );

      const transferEvent = TransferEvent.fromEvent(event);

      assertExists(transferEvent);
      assertEquals(transferEvent.from, from);
      assertEquals(transferEvent.to, to);
      assertEquals(transferEvent.amount, amount);
      assertEquals(transferEvent.asset, assetString);
    });

    it("should throw for invalid SEP-11 asset format", () => {
      const from = Keypair.random().publicKey();
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("transfer"),
          new Address(from).toScVal(),
          new Address(to).toScVal(),
          xdr.ScVal.scvString("invalid-asset"),
        ],
        nativeToScVal(1000000n, { type: "i128" })
      );

      const transferEvent = TransferEvent.fromEvent(event);
      assertThrows(
        () => transferEvent.asset,
        Error,
        "Invalid SEP-11 asset format: invalid-asset"
      );
    });

    it("should throw for non-SAC transfer event", () => {
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

      assertThrows(
        () => TransferEvent.fromEvent(event),
        Error,
        "does not match transfer schema"
      );
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
          xdr.ScVal.scvString(assetString),
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
          xdr.ScVal.scvString(assetString),
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
          xdr.ScVal.scvString(assetString),
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
      // Create a valid event first, then modify the value to test muxed handling
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("transfer"),
          new Address(from).toScVal(),
          new Address(to).toScVal(),
          xdr.ScVal.scvString(assetString),
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
          xdr.ScVal.scvString(assetString),
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
    it("should create filter for any SAC transfer event", () => {
      const filter = TransferEvent.toTopicFilter({});

      assertEquals(filter.length, 4);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals(filter[1], "*");
      assertEquals(filter[2], "*");
      assertEquals(filter[3], "*");
    });

    it("should create filter for transfers from specific address", () => {
      const from = Keypair.random().publicKey();
      const filter = TransferEvent.toTopicFilter({ from });

      assertEquals(filter.length, 4);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals((filter[1] as xdr.ScVal).switch().name, "scvAddress");
      assertEquals(filter[2], "*");
      assertEquals(filter[3], "*");
    });

    it("should create filter for transfers to specific address", () => {
      const to = Keypair.random().publicKey();
      const filter = TransferEvent.toTopicFilter({ to });

      assertEquals(filter.length, 4);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals(filter[1], "*");
      assertEquals((filter[2] as xdr.ScVal).switch().name, "scvAddress");
      assertEquals(filter[3], "*");
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
