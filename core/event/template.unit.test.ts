import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Buffer } from "buffer";
import { xdr, Keypair, Address, nativeToScVal } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import { Event } from "@/event/event.ts";
import { EventTemplate } from "@/event/template.ts";
import type { ContractId } from "@/strkeys/types.ts";
import { EventType } from "@/event/types.ts";
import type { EventSchema } from "@/event/types.ts";

// ============================================================================
// Test Schemas
// ============================================================================

const SimpleEventSchema = {
  name: "simple",
  topics: [{ name: "user", type: "address" }],
  value: { name: "amount", type: "i128" },
} as const satisfies EventSchema;

class SimpleEvent extends EventTemplate<typeof SimpleEventSchema> {
  static override schema = SimpleEventSchema;
  get user(): string {
    return this.get("user");
  }
  get amount(): bigint {
    return this.get("amount");
  }
}

const MultiTopicSchema = {
  name: "multi",
  topics: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "flag", type: "bool" },
  ],
  value: { name: "data", type: "u32" },
} as const satisfies EventSchema;

class MultiTopicEvent extends EventTemplate<typeof MultiTopicSchema> {
  static override schema = MultiTopicSchema;
  get from(): string {
    return this.get("from");
  }
  get to(): string {
    return this.get("to");
  }
  get flag(): boolean {
    return this.get("flag");
  }
  get data(): number {
    return this.get("data");
  }
}

const AllTypesSchema = {
  name: "alltypes",
  topics: [
    { name: "strField", type: "string" },
    { name: "symField", type: "symbol" },
  ],
  value: { name: "numField", type: "i32" },
} as const satisfies EventSchema;

class AllTypesEvent extends EventTemplate<typeof AllTypesSchema> {
  static override schema = AllTypesSchema;
  get strField(): string {
    return this.get("strField");
  }
  get symField(): string {
    return this.get("symField");
  }
  get numField(): number {
    return this.get("numField");
  }
}

const BytesSchema = {
  name: "bytes_event",
  topics: [{ name: "identifier", type: "bytes" }],
  value: { name: "data", type: "bytes" },
} as const satisfies EventSchema;

class BytesEvent extends EventTemplate<typeof BytesSchema> {
  static override schema = BytesSchema;
  get identifier(): Uint8Array {
    return this.get("identifier");
  }
  get data(): Uint8Array {
    return this.get("data");
  }
}

const BigIntSchema = {
  name: "bigint_event",
  topics: [{ name: "timestamp", type: "timepoint" }],
  value: { name: "amount", type: "u256" },
} as const satisfies EventSchema;

class BigIntEvent extends EventTemplate<typeof BigIntSchema> {
  static override schema = BigIntSchema;
  get timestamp(): bigint {
    return this.get("timestamp");
  }
  get amount(): bigint {
    return this.get("amount");
  }
}

const VecSchema = {
  name: "vec_event",
  topics: [],
  value: { name: "items", type: "vec" },
} as const satisfies EventSchema;

class VecEvent extends EventTemplate<typeof VecSchema> {
  static override schema = VecSchema;
  get items(): unknown[] {
    return this.get("items");
  }
}

const MapSchema = {
  name: "map_event",
  topics: [],
  value: { name: "data", type: "map" },
} as const satisfies EventSchema;

class MapEvent extends EventTemplate<typeof MapSchema> {
  static override schema = MapSchema;
  get data(): Record<string, unknown> | Map<unknown, unknown> {
    return this.get("data");
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

const TEST_CONTRACT_ID =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

function createMockEvent(
  topics: xdr.ScVal[],
  value: xdr.ScVal,
  contractId: string = TEST_CONTRACT_ID
): Event {
  return new Event({
    id: "0000000000000000000-0000000000",
    type: EventType.Contract,
    ledger: 12345,
    ledgerClosedAt: "2024-01-01T00:00:00Z",
    transactionIndex: 0,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: "abc123",
    contractId: contractId as ContractId,
    topic: topics,
    value: value,
  });
}

function createMockEventResponse(
  topics: xdr.ScVal[],
  value: xdr.ScVal,
  contractId: string = TEST_CONTRACT_ID
): Api.EventResponse {
  // Create a mock contractId object that has a contractId() method like Contract
  const mockContractId = {
    contractId: () => contractId,
  };

  return {
    id: "0000000000000000000-0000000000",
    type: "contract",
    ledger: 12345,
    ledgerClosedAt: "2024-01-01T00:00:00Z",
    contractId: mockContractId,
    topic: topics,
    value: value,
    inSuccessfulContractCall: true,
    txHash: "abc123",
    transactionIndex: 0,
    operationIndex: 0,
  } as unknown as Api.EventResponse;
}

// ============================================================================
// Tests
// ============================================================================

describe("EventTemplate", () => {
  describe("is()", () => {
    it("should return true for matching event", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("simple"), new Address(userAddress).toScVal()],
        nativeToScVal(1000n, { type: "i128" })
      );

      assertEquals(SimpleEvent.is(event), true);
    });

    it("should return false for wrong topic count", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("simple")], // missing user topic
        nativeToScVal(1000n, { type: "i128" })
      );

      assertEquals(SimpleEvent.is(event), false);
    });

    it("should return false for wrong event name", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("wrong_name"), new Address(userAddress).toScVal()],
        nativeToScVal(1000n, { type: "i128" })
      );

      assertEquals(SimpleEvent.is(event), false);
    });

    it("should return false for wrong topic field type", () => {
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("simple"),
          xdr.ScVal.scvU32(123), // should be address
        ],
        nativeToScVal(1000n, { type: "i128" })
      );

      assertEquals(SimpleEvent.is(event), false);
    });

    it("should return false for wrong value type", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("simple"), new Address(userAddress).toScVal()],
        xdr.ScVal.scvString("not a bigint") // should be i128
      );

      assertEquals(SimpleEvent.is(event), false);
    });

    it("should validate bool topic type", () => {
      const from = Keypair.random().publicKey();
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("multi"),
          new Address(from).toScVal(),
          new Address(to).toScVal(),
          xdr.ScVal.scvBool(true),
        ],
        xdr.ScVal.scvU32(42)
      );

      assertEquals(MultiTopicEvent.is(event), true);
    });

    it("should return false for wrong bool type", () => {
      const from = Keypair.random().publicKey();
      const to = Keypair.random().publicKey();
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("multi"),
          new Address(from).toScVal(),
          new Address(to).toScVal(),
          xdr.ScVal.scvString("not a bool"), // should be bool
        ],
        xdr.ScVal.scvU32(42)
      );

      assertEquals(MultiTopicEvent.is(event), false);
    });

    it("should validate bytes type", () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("bytes_event"),
          xdr.ScVal.scvBytes(Buffer.from(bytes)),
        ],
        xdr.ScVal.scvBytes(Buffer.from(bytes))
      );

      assertEquals(BytesEvent.is(event), true);
    });

    it("should return false for wrong bytes type", () => {
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("bytes_event"),
          xdr.ScVal.scvString("not bytes"), // should be bytes
        ],
        xdr.ScVal.scvBytes(Buffer.from([1, 2, 3]))
      );

      assertEquals(BytesEvent.is(event), false);
    });

    it("should validate bigint types (timepoint, u256)", () => {
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("bigint_event"),
          xdr.ScVal.scvTimepoint(new xdr.Uint64(BigInt(1700000000))),
        ],
        nativeToScVal(BigInt("12345678901234567890"), { type: "u256" })
      );

      assertEquals(BigIntEvent.is(event), true);
    });

    it("should return false for wrong bigint type", () => {
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("bigint_event"),
          xdr.ScVal.scvU32(123), // should be timepoint (bigint)
        ],
        nativeToScVal(BigInt("12345"), { type: "u256" })
      );

      assertEquals(BigIntEvent.is(event), false);
    });

    it("should validate vec type", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("vec_event")],
        xdr.ScVal.scvVec([xdr.ScVal.scvU32(1), xdr.ScVal.scvU32(2)])
      );

      assertEquals(VecEvent.is(event), true);
    });

    it("should return false for wrong vec type", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("vec_event")],
        xdr.ScVal.scvU32(123) // should be vec
      );

      assertEquals(VecEvent.is(event), false);
    });

    it("should validate map type (as Map)", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("map_event")],
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("key"),
            val: xdr.ScVal.scvU32(123),
          }),
        ])
      );

      assertEquals(MapEvent.is(event), true);
    });

    it("should return false for wrong map type", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("map_event")],
        xdr.ScVal.scvVec([xdr.ScVal.scvU32(1)]) // should be map
      );

      assertEquals(MapEvent.is(event), false);
    });
  });

  describe("get()", () => {
    it("should get value field", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("simple"), new Address(userAddress).toScVal()],
        nativeToScVal(1000n, { type: "i128" })
      );

      const simpleEvent = SimpleEvent.fromEvent(event);
      assertEquals(simpleEvent.get("amount"), 1000n);
    });

    it("should get topic field", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("simple"), new Address(userAddress).toScVal()],
        nativeToScVal(1000n, { type: "i128" })
      );

      const simpleEvent = SimpleEvent.fromEvent(event);
      assertEquals(simpleEvent.get("user"), userAddress);
    });

    it("should throw for unknown field", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("simple"), new Address(userAddress).toScVal()],
        nativeToScVal(1000n, { type: "i128" })
      );

      const simpleEvent = SimpleEvent.fromEvent(event);

      assertThrows(
        // deno-lint-ignore no-explicit-any
        () => (simpleEvent as any).get("unknown_field"),
        Error,
        "Unknown field: unknown_field"
      );
    });
  });

  describe("fromEvent()", () => {
    it("should create instance from matching event", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("simple"), new Address(userAddress).toScVal()],
        nativeToScVal(1000n, { type: "i128" })
      );

      const simpleEvent = SimpleEvent.fromEvent(event);

      assertExists(simpleEvent);
      assertEquals(simpleEvent.get("user"), userAddress);
      assertEquals(simpleEvent.get("amount"), 1000n);
    });

    it("should throw for non-matching event", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("wrong_name")],
        xdr.ScVal.scvU32(123)
      );

      assertThrows(
        () => SimpleEvent.fromEvent(event),
        Error,
        'Event does not match simple schema. Expected 2 topics with name "simple".'
      );
    });
  });

  describe("tryFromEvent()", () => {
    it("should create instance from matching event", () => {
      const userAddress = Keypair.random().publicKey();
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("simple"), new Address(userAddress).toScVal()],
        nativeToScVal(1000n, { type: "i128" })
      );

      const simpleEvent = SimpleEvent.tryFromEvent(event);

      assertExists(simpleEvent);
      assertEquals(simpleEvent!.get("user"), userAddress);
    });

    it("should return undefined for non-matching event", () => {
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("wrong_name")],
        xdr.ScVal.scvU32(123)
      );

      const result = SimpleEvent.tryFromEvent(event);
      assertEquals(result, undefined);
    });
  });

  describe("fromEventResponse()", () => {
    it("should create instance from matching EventResponse", () => {
      const userAddress = Keypair.random().publicKey();
      const response = createMockEventResponse(
        [xdr.ScVal.scvSymbol("simple"), new Address(userAddress).toScVal()],
        nativeToScVal(1000n, { type: "i128" })
      );

      const simpleEvent = SimpleEvent.fromEventResponse(response);

      assertExists(simpleEvent);
      assertEquals(simpleEvent.get("user"), userAddress);
      assertEquals(simpleEvent.get("amount"), 1000n);
    });

    it("should throw for non-matching EventResponse", () => {
      const response = createMockEventResponse(
        [xdr.ScVal.scvSymbol("wrong_name")],
        xdr.ScVal.scvU32(123)
      );

      assertThrows(
        () => SimpleEvent.fromEventResponse(response),
        Error,
        'Event does not match simple schema. Expected 2 topics with name "simple".'
      );
    });
  });

  describe("tryFromEventResponse()", () => {
    it("should create instance from matching EventResponse", () => {
      const userAddress = Keypair.random().publicKey();
      const response = createMockEventResponse(
        [xdr.ScVal.scvSymbol("simple"), new Address(userAddress).toScVal()],
        nativeToScVal(1000n, { type: "i128" })
      );

      const simpleEvent = SimpleEvent.tryFromEventResponse(response);

      assertExists(simpleEvent);
      assertEquals(simpleEvent!.get("user"), userAddress);
    });

    it("should return undefined for non-matching EventResponse", () => {
      const response = createMockEventResponse(
        [xdr.ScVal.scvSymbol("wrong_name")],
        xdr.ScVal.scvU32(123)
      );

      const result = SimpleEvent.tryFromEventResponse(response);
      assertEquals(result, undefined);
    });
  });

  describe("toTopicFilter()", () => {
    it("should create filter with just event name", () => {
      const filter = SimpleEvent.toTopicFilter({});

      assertEquals(filter.length, 2);
      assertExists(filter[0]); // event name
      assertEquals(filter[1], null); // wildcard for user
    });

    it("should create filter with specific address", () => {
      const userAddress = Keypair.random().publicKey();
      const filter = SimpleEvent.toTopicFilter({ user: userAddress });

      assertEquals(filter.length, 2);
      assertExists(filter[0]); // event name
      assertExists(filter[1]); // specific address
    });

    it("should create filter with bool value", () => {
      const from = Keypair.random().publicKey();
      const filter = MultiTopicEvent.toTopicFilter({ from, flag: true });

      assertEquals(filter.length, 4);
      assertExists(filter[0]); // event name
      assertExists(filter[1]); // from address
      assertEquals(filter[2], null); // wildcard for to
      assertExists(filter[3]); // bool flag
    });

    it("should create filter with symbol value", () => {
      const filter = AllTypesEvent.toTopicFilter({ symField: "test_symbol" });

      assertEquals(filter.length, 3);
      assertExists(filter[0]); // event name
      assertEquals(filter[1], null); // wildcard for strField
      assertExists(filter[2]); // symbol value
    });

    it("should create filter with string value", () => {
      const filter = AllTypesEvent.toTopicFilter({ strField: "hello world" });

      assertEquals(filter.length, 3);
      assertExists(filter[0]); // event name
      assertExists(filter[1]); // string value
      assertEquals(filter[2], null); // wildcard for symField
    });

    it("should create filter with bytes value", () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const filter = BytesEvent.toTopicFilter({ identifier: bytes });

      assertEquals(filter.length, 2);
      assertExists(filter[0]); // event name
      assertExists(filter[1]); // bytes value
    });

    it("should create filter with all wildcards when no args", () => {
      const filter = MultiTopicEvent.toTopicFilter();

      assertEquals(filter.length, 4);
      assertExists(filter[0]); // event name is never wildcard
      assertEquals(filter[1], null); // from wildcard
      assertEquals(filter[2], null); // to wildcard
      assertEquals(filter[3], null); // flag wildcard
    });
  });

  describe("toTopicFilter() with u32 and i32 types", () => {
    const NumericSchema = {
      name: "numeric",
      topics: [
        { name: "unsigned", type: "u32" },
        { name: "signed", type: "i32" },
      ],
      value: { name: "data", type: "u32" },
    } as const satisfies EventSchema;

    class NumericEvent extends EventTemplate<typeof NumericSchema> {
      static override schema = NumericSchema;
    }

    it("should create filter with u32 value", () => {
      const filter = NumericEvent.toTopicFilter({ unsigned: 42 });

      assertEquals(filter.length, 3);
      assertExists(filter[0]); // event name
      assertExists(filter[1]); // u32 value
      assertEquals(filter[2], null); // wildcard for signed
    });

    it("should create filter with i32 value", () => {
      const filter = NumericEvent.toTopicFilter({ signed: -42 });

      assertEquals(filter.length, 3);
      assertExists(filter[0]); // event name
      assertEquals(filter[1], null); // wildcard for unsigned
      assertExists(filter[2]); // i32 value
    });
  });

  describe("toTopicFilter() error handling", () => {
    // Schema with an unsupported type for conversion
    const UnsupportedSchema = {
      name: "unsupported",
      topics: [{ name: "bignum", type: "u128" }],
      value: { name: "data", type: "u32" },
    } as const satisfies EventSchema;

    class UnsupportedEvent extends EventTemplate<typeof UnsupportedSchema> {
      static override schema = UnsupportedSchema;
    }

    it("should throw for unsupported type in filter", () => {
      assertThrows(
        () => UnsupportedEvent.toTopicFilter({ bignum: 12345n }),
        Error,
        "Cannot convert value to ScVal for type: u128"
      );
    });
  });

  describe("validateFieldType edge cases", () => {
    it("should validate number types correctly", () => {
      const event = createMockEvent(
        [
          xdr.ScVal.scvSymbol("alltypes"),
          xdr.ScVal.scvString("hello"),
          xdr.ScVal.scvSymbol("sym"),
        ],
        xdr.ScVal.scvI32(-42)
      );

      assertEquals(AllTypesEvent.is(event), true);
    });

    it("should return true for unknown type in validateFieldType", () => {
      // Create a schema with a type that falls through to default
      const UnknownTypeSchema = {
        name: "unknown",
        topics: [],
        // This will use the default case in validateFieldType
        value: { name: "data", type: "void" as "u32" }, // type assertion to bypass TS
      } as const;

      class UnknownTypeEvent extends EventTemplate<typeof UnknownTypeSchema> {
        static override schema = UnknownTypeSchema as EventSchema;
      }

      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("unknown")],
        xdr.ScVal.scvVoid()
      );

      // The default case in validateFieldType returns true
      assertEquals(UnknownTypeEvent.is(event), true);
    });
  });

  describe("validateFieldType for all bigint types", () => {
    it("should validate u64 type", () => {
      const U64Schema = {
        name: "u64_event",
        topics: [],
        value: { name: "amount", type: "u64" },
      } as const satisfies EventSchema;

      class U64Event extends EventTemplate<typeof U64Schema> {
        static override schema = U64Schema;
      }

      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("u64_event")],
        nativeToScVal(BigInt("18446744073709551615"), { type: "u64" })
      );

      assertEquals(U64Event.is(event), true);
    });

    it("should validate i64 type", () => {
      const I64Schema = {
        name: "i64_event",
        topics: [],
        value: { name: "amount", type: "i64" },
      } as const satisfies EventSchema;

      class I64Event extends EventTemplate<typeof I64Schema> {
        static override schema = I64Schema;
      }

      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("i64_event")],
        nativeToScVal(BigInt("-9223372036854775808"), { type: "i64" })
      );

      assertEquals(I64Event.is(event), true);
    });

    it("should validate u128 type", () => {
      const U128Schema = {
        name: "u128_event",
        topics: [],
        value: { name: "amount", type: "u128" },
      } as const satisfies EventSchema;

      class U128Event extends EventTemplate<typeof U128Schema> {
        static override schema = U128Schema;
      }

      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("u128_event")],
        nativeToScVal(BigInt("340282366920938463463374607431768211455"), {
          type: "u128",
        })
      );

      assertEquals(U128Event.is(event), true);
    });

    it("should validate i128 type", () => {
      const I128Schema = {
        name: "i128_event",
        topics: [],
        value: { name: "amount", type: "i128" },
      } as const satisfies EventSchema;

      class I128Event extends EventTemplate<typeof I128Schema> {
        static override schema = I128Schema;
      }

      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("i128_event")],
        nativeToScVal(BigInt("-170141183460469231731687303715884105728"), {
          type: "i128",
        })
      );

      assertEquals(I128Event.is(event), true);
    });

    it("should validate i256 type", () => {
      const I256Schema = {
        name: "i256_event",
        topics: [],
        value: { name: "amount", type: "i256" },
      } as const satisfies EventSchema;

      class I256Event extends EventTemplate<typeof I256Schema> {
        static override schema = I256Schema;
      }

      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("i256_event")],
        nativeToScVal(BigInt("-12345678901234567890"), { type: "i256" })
      );

      assertEquals(I256Event.is(event), true);
    });

    it("should validate duration type", () => {
      const DurationSchema = {
        name: "duration_event",
        topics: [],
        value: { name: "duration", type: "duration" },
      } as const satisfies EventSchema;

      class DurationEvent extends EventTemplate<typeof DurationSchema> {
        static override schema = DurationSchema;
      }

      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("duration_event")],
        xdr.ScVal.scvDuration(new xdr.Uint64(BigInt(3600)))
      );

      assertEquals(DurationEvent.is(event), true);
    });
  });

  describe("map validation with Map instance vs object", () => {
    it("should validate map value as Map instance", () => {
      // Map with non-string keys returns a Map instance
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("map_event")],
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvU32(1),
            val: xdr.ScVal.scvString("one"),
          }),
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvU32(2),
            val: xdr.ScVal.scvString("two"),
          }),
        ])
      );

      assertEquals(MapEvent.is(event), true);
    });

    it("should validate map value as object (with string keys)", () => {
      // Map with string keys returns a plain object
      const event = createMockEvent(
        [xdr.ScVal.scvSymbol("map_event")],
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: xdr.ScVal.scvSymbol("key1"),
            val: xdr.ScVal.scvString("value1"),
          }),
        ])
      );

      assertEquals(MapEvent.is(event), true);
    });
  });
});
