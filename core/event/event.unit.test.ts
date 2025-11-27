import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "buffer";
import { xdr, Keypair, Address, nativeToScVal } from "stellar-sdk";
import { Event } from "@/event/event.ts";
import { EventTemplate } from "@/event/template.ts";
import type { ContractId } from "@/strkeys/types.ts";
import { EventType, type EventSchema } from "@/event/types.ts";

// Test schema for a simple custom event
const TestEventSchema = {
  name: "test_event",
  topics: [
    { name: "user", type: "address" },
    { name: "flag", type: "bool" },
  ],
  value: { name: "count", type: "u32" },
} as const satisfies EventSchema;

class TestEvent extends EventTemplate<typeof TestEventSchema> {
  static override schema = TestEventSchema;

  get user(): string {
    return this.get("user");
  }
  get flag(): boolean {
    return this.get("flag");
  }
  get count(): number {
    return this.get("count");
  }
}

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

describe("Event", () => {
  describe("constructor", () => {
    it("should create an Event from valid args", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("transfer")],
        xdr.ScVal.scvU32(100)
      );

      assertExists(event);
      assertEquals(event.ledger, 12345);
      assertEquals(event.inSuccessfulContractCall, true);
    });

    it("should create an Event without contractId", () => {
      const event = new Event({
        id: "0000000000000000000-0000000000",
        type: EventType.Contract,
        ledger: 12345,
        ledgerClosedAt: "2024-01-01T00:00:00Z",
        transactionIndex: 0,
        operationIndex: 0,
        inSuccessfulContractCall: true,
        txHash: "abc123",
        topic: [xdr.ScVal.scvSymbol("test")],
        value: xdr.ScVal.scvU32(100),
        // no contractId
      });

      assertExists(event);
      assertEquals(event.contractId, undefined);
    });

    it("should throw for invalid contractId", () => {
      assertThrows(
        () =>
          new Event({
            id: "0000000000000000000-0000000000",
            type: EventType.Contract,
            ledger: 12345,
            ledgerClosedAt: "2024-01-01T00:00:00Z",
            transactionIndex: 0,
            operationIndex: 0,
            inSuccessfulContractCall: true,
            txHash: "abc123",
            contractId: "invalid-contract-id" as ContractId,
            topic: [xdr.ScVal.scvSymbol("test")],
            value: xdr.ScVal.scvU32(100),
          }),
        Error,
        "Invalid event: contractId is not a valid ContractId"
      );
    });

    it("should throw for invalid event id", () => {
      assertThrows(
        () =>
          new Event({
            id: "invalid-event-id",
            type: EventType.Contract,
            ledger: 12345,
            ledgerClosedAt: "2024-01-01T00:00:00Z",
            transactionIndex: 0,
            operationIndex: 0,
            inSuccessfulContractCall: true,
            txHash: "abc123",
            contractId:
              "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId,
            topic: [xdr.ScVal.scvSymbol("test")],
            value: xdr.ScVal.scvU32(100),
          }),
        Error,
        "Invalid event: id is not a valid EventId"
      );
    });
  });

  describe("topics getter", () => {
    it("should parse scvalTopics to ScValParsed[]", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("test"),
          new Address(userAddress).toScVal(),
          xdr.ScVal.scvU32(42),
        ],
        xdr.ScVal.scvVoid()
      );

      const topics = event.topics;

      assertEquals(topics.length, 3);
      assertEquals(topics[0], "test");
      assertEquals(topics[1], userAddress);
      assertEquals(topics[2], 42);
    });
  });

  describe("value getter", () => {
    it("should parse scvalValue to ScValParsed", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("test")],
        nativeToScVal(1000000n, { type: "i128" })
      );

      assertEquals(event.value, 1000000n);
    });

    it("should parse map value", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("test")],
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("amount"),
            val: xdr.ScVal.scvU32(100),
          }),
        ])
      );

      const value = event.value as Record<string, unknown>;
      assertEquals(value["amount"], 100);
    });
  });

  describe("fromEventResponse()", () => {
    it("should create Event from contract type EventResponse", () => {
      const mockContractId = {
        contractId: () =>
          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
      };

      const response = {
        id: "0000000000000000000-0000000000",
        type: "contract",
        ledger: 12345,
        ledgerClosedAt: "2024-01-01T00:00:00Z",
        contractId: mockContractId,
        topic: [xdr.ScVal.scvSymbol("test")],
        value: xdr.ScVal.scvU32(100),
        inSuccessfulContractCall: true,
        txHash: "abc123",
        transactionIndex: 0,
        operationIndex: 0,
      } as unknown as import("stellar-sdk/rpc").Api.EventResponse;

      const event = Event.fromEventResponse(response);

      assertExists(event);
      assertEquals(event.type, EventType.Contract);
      assertEquals(
        event.contractId,
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
      );
    });

    it("should create Event from system type EventResponse", () => {
      const response = {
        id: "0000000000000000000-0000000000",
        type: "system",
        ledger: 12345,
        ledgerClosedAt: "2024-01-01T00:00:00Z",
        contractId: undefined,
        topic: [xdr.ScVal.scvSymbol("test")],
        value: xdr.ScVal.scvU32(100),
        inSuccessfulContractCall: true,
        txHash: "abc123",
        transactionIndex: 0,
        operationIndex: 0,
      } as unknown as import("stellar-sdk/rpc").Api.EventResponse;

      const event = Event.fromEventResponse(response);

      assertExists(event);
      assertEquals(event.type, EventType.System);
      assertEquals(event.contractId, undefined);
    });

    it("should throw for unknown event type", () => {
      const response = {
        id: "0000000000000000000-0000000000",
        type: "unknown_type",
        ledger: 12345,
        ledgerClosedAt: "2024-01-01T00:00:00Z",
        contractId: undefined,
        topic: [xdr.ScVal.scvSymbol("test")],
        value: xdr.ScVal.scvU32(100),
        inSuccessfulContractCall: true,
        txHash: "abc123",
        transactionIndex: 0,
        operationIndex: 0,
      } as unknown as import("stellar-sdk/rpc").Api.EventResponse;

      assertThrows(
        () => Event.fromEventResponse(response),
        Error,
        "Unknown event type: unknown_type"
      );
    });

    it("should throw for invalid contractId in EventResponse", () => {
      const mockContractId = {
        contractId: () => "invalid-contract-id",
      };

      const response = {
        id: "0000000000000000000-0000000000",
        type: "contract",
        ledger: 12345,
        ledgerClosedAt: "2024-01-01T00:00:00Z",
        contractId: mockContractId,
        topic: [xdr.ScVal.scvSymbol("test")],
        value: xdr.ScVal.scvU32(100),
        inSuccessfulContractCall: true,
        txHash: "abc123",
        transactionIndex: 0,
        operationIndex: 0,
      } as unknown as import("stellar-sdk/rpc").Api.EventResponse;

      assertThrows(
        () => Event.fromEventResponse(response),
        Error,
        "Invalid event: contractId is not a valid ContractId"
      );
    });

    it("should create Event without contractId when response has no contractId", () => {
      const response = {
        id: "0000000000000000000-0000000000",
        type: "contract",
        ledger: 12345,
        ledgerClosedAt: "2024-01-01T00:00:00Z",
        contractId: undefined,
        topic: [xdr.ScVal.scvSymbol("test")],
        value: xdr.ScVal.scvU32(100),
        inSuccessfulContractCall: true,
        txHash: "abc123",
        transactionIndex: 0,
        operationIndex: 0,
      } as unknown as import("stellar-sdk/rpc").Api.EventResponse;

      const event = Event.fromEventResponse(response);

      assertExists(event);
      assertEquals(event.contractId, undefined);
    });
  });
});

describe("EventTemplate", () => {
  describe("is()", () => {
    it("should return true for matching event", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("test_event"),
          new Address(userAddress).toScVal(),
          xdr.ScVal.scvBool(true),
        ],
        xdr.ScVal.scvU32(42)
      );

      assertEquals(TestEvent.is(event), true);
    });

    it("should return false for wrong event name", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("wrong_event"),
          new Address(userAddress).toScVal(),
          xdr.ScVal.scvBool(true),
        ],
        xdr.ScVal.scvU32(42)
      );

      assertEquals(TestEvent.is(event), false);
    });

    it("should return false for wrong topic count", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("test_event")],
        xdr.ScVal.scvU32(42)
      );

      assertEquals(TestEvent.is(event), false);
    });

    it("should return false for wrong topic type", () => {
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("test_event"),
          xdr.ScVal.scvU32(123), // should be address
          xdr.ScVal.scvBool(true),
        ],
        xdr.ScVal.scvU32(42)
      );

      assertEquals(TestEvent.is(event), false);
    });

    it("should return false for wrong value type", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("test_event"),
          new Address(userAddress).toScVal(),
          xdr.ScVal.scvBool(true),
        ],
        xdr.ScVal.scvString("wrong") // should be u32
      );

      assertEquals(TestEvent.is(event), false);
    });
  });

  describe("fromEvent()", () => {
    it("should create typed event from matching event", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("test_event"),
          new Address(userAddress).toScVal(),
          xdr.ScVal.scvBool(true),
        ],
        xdr.ScVal.scvU32(42)
      );

      const testEvent = TestEvent.fromEvent(event);

      assertExists(testEvent);
      assertEquals(testEvent.user, userAddress);
      assertEquals(testEvent.flag, true);
      assertEquals(testEvent.count, 42);
    });

    it("should throw for non-matching event", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("wrong_event")],
        xdr.ScVal.scvU32(42)
      );

      assertThrows(
        () => TestEvent.fromEvent(event),
        Error,
        "does not match test_event schema"
      );
    });
  });

  describe("tryFromEvent()", () => {
    it("should create typed event from matching event", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("test_event"),
          new Address(userAddress).toScVal(),
          xdr.ScVal.scvBool(true),
        ],
        xdr.ScVal.scvU32(42)
      );

      const testEvent = TestEvent.tryFromEvent(event);

      assertExists(testEvent);
      assertEquals(testEvent.user, userAddress);
    });

    it("should return undefined for non-matching event", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("wrong_event")],
        xdr.ScVal.scvU32(42)
      );

      const result = TestEvent.tryFromEvent(event);

      assertEquals(result, undefined);
    });
  });

  describe("get()", () => {
    it("should get topic fields by name", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("test_event"),
          new Address(userAddress).toScVal(),
          xdr.ScVal.scvBool(false),
        ],
        xdr.ScVal.scvU32(99)
      );

      const testEvent = TestEvent.fromEvent(event);

      assertEquals(testEvent.get("user"), userAddress);
      assertEquals(testEvent.get("flag"), false);
    });

    it("should get value field by name", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("test_event"),
          new Address(userAddress).toScVal(),
          xdr.ScVal.scvBool(true),
        ],
        xdr.ScVal.scvU32(12345)
      );

      const testEvent = TestEvent.fromEvent(event);

      assertEquals(testEvent.get("count"), 12345);
    });
  });

  describe("toTopicFilter()", () => {
    it("should create filter with all wildcards when no args", () => {
      const filter = TestEvent.toTopicFilter({});

      assertEquals(filter.length, 3);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals(filter[1], "*"); // wildcard
      assertEquals(filter[2], "*"); // wildcard
    });

    it("should create filter with specific address", () => {
      const userAddress = Keypair.random().publicKey();
      const filter = TestEvent.toTopicFilter({ user: userAddress });

      assertEquals(filter.length, 3);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals((filter[1] as xdr.ScVal).switch().name, "scvAddress");
      assertEquals(filter[2], "*"); // wildcard
    });

    it("should create filter with specific bool", () => {
      const filter = TestEvent.toTopicFilter({ flag: true });

      assertEquals(filter.length, 3);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals(filter[1], "*"); // wildcard
      assertEquals((filter[2] as xdr.ScVal).switch().name, "scvBool");
    });

    it("should create filter with all fields specified", () => {
      const userAddress = Keypair.random().publicKey();
      const filter = TestEvent.toTopicFilter({
        user: userAddress,
        flag: false,
      });

      assertEquals(filter.length, 3);
      assertEquals((filter[0] as xdr.ScVal).switch().name, "scvSymbol");
      assertEquals((filter[1] as xdr.ScVal).switch().name, "scvAddress");
      assertEquals((filter[2] as xdr.ScVal).switch().name, "scvBool");
    });
  });
});

// Schema with bigint value
const BigIntEventSchema = {
  name: "big_event",
  topics: [{ name: "sender", type: "address" }],
  value: { name: "amount", type: "i128" },
} as const satisfies EventSchema;

class BigIntEvent extends EventTemplate<typeof BigIntEventSchema> {
  static override schema = BigIntEventSchema;

  get sender(): string {
    return this.get("sender");
  }
  get amount(): bigint {
    return this.get("amount");
  }
}

describe("EventTemplate with bigint value", () => {
  it("should validate i128 value type", () => {
    const senderAddress = Keypair.random().publicKey();
    const event = createMockEvent(
      [xdr.ScVal.scvSymbol("big_event"), new Address(senderAddress).toScVal()],
      nativeToScVal(9999999999999n, { type: "i128" })
    );

    assertEquals(BigIntEvent.is(event), true);

    const bigEvent = BigIntEvent.fromEvent(event);
    assertEquals(bigEvent.amount, 9999999999999n);
  });

  it("should reject non-bigint value", () => {
    const senderAddress = Keypair.random().publicKey();
    const event = createMockEvent(
      [xdr.ScVal.scvSymbol("big_event"), new Address(senderAddress).toScVal()],
      xdr.ScVal.scvU32(100) // wrong - should be i128
    );

    assertEquals(BigIntEvent.is(event), false);
  });
});

// Schema with bytes
const BytesEventSchema = {
  name: "bytes_event",
  topics: [],
  value: { name: "data", type: "bytes" },
} as const satisfies EventSchema;

class BytesEvent extends EventTemplate<typeof BytesEventSchema> {
  static override schema = BytesEventSchema;

  get data(): Uint8Array {
    return this.get("data");
  }
}

describe("EventTemplate with bytes value", () => {
  it("should validate bytes value type", () => {
    const event = createMockEvent(
      [xdr.ScVal.scvSymbol("bytes_event")],
      xdr.ScVal.scvBytes(Buffer.from([1, 2, 3, 4, 5]))
    );

    assertEquals(BytesEvent.is(event), true);

    const bytesEvent = BytesEvent.fromEvent(event);
    assertEquals(bytesEvent.data.length, 5);
    assertEquals(bytesEvent.data[0], 1);
  });
});
