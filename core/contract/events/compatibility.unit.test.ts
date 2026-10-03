import { EventTemplate } from "@/event/template.ts";
import * as FILTER_ERROR from "@/event/event-filter/error.ts";
import { Contract as SdkContract } from "stellar-sdk";
import { assertEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  contractId,
  eventEntry,
} from "colibri-internal/tests/binding-fixtures.ts";
import {
  option,
  struct,
  udt,
} from "colibri-internal/tests/soroban-values-fixtures.ts";
import { Address, nativeToScVal, xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import { ContractEventRegistry } from "@/contract/events/index.ts";
import * as ERROR from "@/contract/events/error.ts";
import { Event } from "@/event/event.ts";
import { EventType } from "@/event/types.ts";
import { EventFilter } from "@/event/event-filter/index.ts";
import type { TopicFilter } from "@/event/event-filter/types.ts";
import { SEP41Events } from "@/event/standards/sep41/index.ts";
const { describe, it } = recordColibriTests(import.meta.url);
const record = (entries: [string, xdr.ScVal][]) =>
  xdr.ScVal.scvMap(
    entries.map(([name, val]) =>
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(name), val })
    ),
  );
const event = (value: xdr.ScVal, topic: xdr.ScVal[]) =>
  new Event({
    id: "0000000042949672960-0000000001",
    type: EventType.Contract,
    ledger: 10,
    ledgerClosedAt: "2026-01-01T00:00:00Z",
    transactionIndex: 1,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: "ab".repeat(32),
    contractId,
    value,
    topic,
  });
const param = (name: string, type: xdr.ScSpecTypeDef) =>
  new xdr.ScSpecEventParamV0({
    name,
    type,
    doc: "",
    location: xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationData,
  });
const u32 = xdr.ScSpecTypeDef.scSpecTypeU32();
const declaration = eventEntry(undefined, "Update", [
  param("a", option(u32)),
  param("b", u32),
], ["update"]);
const address = new Address(
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
).toScVal();
const amount = nativeToScVal(7n, { type: "i128" });
const topics = [xdr.ScVal.scvSymbol("transfer"), address, address];

describe("sparse and extended contract event compatibility", () => {
  it("normalizes sparse optional fields and retains extra wire data", () => {
    const registry = new ContractEventRegistry(new Spec([declaration]));
    for (
      const raw of [
        record([["b", xdr.ScVal.scvU32(7)]]),
        record([["a", xdr.ScVal.scvVoid()], ["b", xdr.ScVal.scvU32(7)], [
          "z",
          xdr.ScVal.scvU32(8),
        ]]),
      ]
    ) {
      const input = event(raw, [xdr.ScVal.scvSymbol("update")]);
      const output = registry.parse(input)!;
      assertEquals(output.fields, { a: null, b: 7 });
      assertEquals(output.scvalValue.toXdr(), raw.toXdr());
    }
    assertEquals(
      registry.parse(event(record([]), [xdr.ScVal.scvSymbol("update")])),
      undefined,
    );
  });
  it("retains ambiguity when two optional declarations match an empty map", () => {
    const declarations = ["a", "b"].map((name) =>
      eventEntry(undefined, "Update", [param(name, option(u32))], ["update"])
    );
    const registry = new ContractEventRegistry(new Spec(declarations));
    assertThrows(
      () => registry.parse(event(record([]), [xdr.ScVal.scvSymbol("update")])),
      ERROR.AMBIGUOUS_EVENT,
    );
  });
  it("decodes nested evolving structs and rejects duplicate map keys", () => {
    const entry = eventEntry(undefined, "Update", [
      param("state", udt("State")),
    ], ["update"]);
    const registry = new ContractEventRegistry(
      new Spec([struct("State", { a: option(u32), b: u32 }), entry]),
    );
    assertEquals(
      registry.parse(
        event(record([["state", record([["b", xdr.ScVal.scvU32(7)]])]]), [
          xdr.ScVal.scvSymbol("update"),
        ]),
      )!.fields,
      { state: { a: null, b: 7 } },
    );
    assertEquals(
      registry.parse(
        event(
          record([["state", record([["b", xdr.ScVal.scvU32(7)]])], [
            "state",
            record([]),
          ]]),
          [xdr.ScVal.scvSymbol("update")],
        ),
      ),
      undefined,
    );
  });
  it("decodes five-topic declarations but reports their RPC query limitation", () => {
    const prefix = ["one", "two", "three", "four", "five"];
    const indexed = prefix.slice(1).map((name) =>
      new xdr.ScSpecEventParamV0({
        name,
        type: xdr.ScSpecTypeDef.scSpecTypeSymbol(),
        doc: "",
        location:
          xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationTopicList,
      })
    );
    const registry = new ContractEventRegistry(
      new Spec([eventEntry(undefined, "Long", indexed, prefix.slice(0, 1))]),
    );
    assertEquals(
      registry.parse(event(record([]), prefix.map(xdr.ScVal.scvSymbol)))!
        .fields,
      { two: "two", three: "three", four: "four", five: "five" },
    );
    assertThrows(
      () => registry.get("Long").toTopicFilter(),
      ERROR.INVALID_FILTER,
    );
  });
  it("preserves four remote constraints plus the trailing wildcard", () => {
    const filter = new EventFilter({
      topics: [[...topics, xdr.ScVal.scvSymbol("extra"), "**"] as TopicFilter],
    });
    assertEquals(filter.toRawEventFilter().topics![0].length, 5);
    assertEquals(
      filter.matchesTopics([
        ...topics,
        xdr.ScVal.scvSymbol("extra"),
        amount,
        amount,
      ]),
      true,
    );
  });
  it("rejects invalid RPC patterns in both remote encoding and local matching", () => {
    for (
      const pattern of [[], ["**", "*"], ["**", "**"], [
        "*",
        "*",
        "*",
        "*",
        "*",
      ]]
    ) {
      const filter = new EventFilter({ topics: [pattern as TopicFilter] });
      assertThrows(
        () => filter.toRawEventFilter(),
        FILTER_ERROR.INVALID_TOPIC_FILTER,
      );
      assertThrows(
        () => filter.matchesTopics(topics),
        FILTER_ERROR.INVALID_TOPIC_FILTER,
      );
    }
  });
  it("keeps generic exact matching while wire/prefix validation remains opt-in", () => {
    const schema = {
      name: "transfer",
      topics: [{ name: "from", type: "address" }, {
        name: "to",
        type: "address",
      }],
      value: { name: "amount", type: "i128" },
    } as const;
    class Exact extends EventTemplate<typeof schema> {
      static override schema = schema;
    }
    const strict = {
      ...schema,
      wireTypes: true,
      topicMatch: "prefix",
    } as const;
    class Prefix extends EventTemplate<typeof strict> {
      static override schema = strict;
    }
    const extended = event(amount, [...topics, amount, amount]);
    assertEquals(Exact.is(extended), false);
    assertEquals(Prefix.is(extended), true);
    assertEquals(Exact.toTopicFilter().length, 3);
    assertEquals(Prefix.toTopicFilter().at(-1), "**");
    const sameNative = event(nativeToScVal(7n, { type: "u64" }), topics);
    assertEquals(Exact.is(sameNative), true);
    assertEquals(Prefix.is(sameNative), false);
  });
  it("accepts SEP-41 extension topics in decoding and generated filters", () => {
    const input = event(record([["amount", amount]]), [
      ...topics,
      xdr.ScVal.scvSymbol("extra"),
      amount,
    ]);
    assertEquals(SEP41Events.TransferEvent.is(input), true);
    assertEquals(SEP41Events.TransferEvent.tryFromEvent(input)!.amount, 7n);
    assertEquals(SEP41Events.TransferEvent.fromEvent(input).amount, 7n);
    assertEquals(
      SEP41Events.TransferEvent.fromEventResponse({
        ...input,
        type: "contract",
        contractId: new SdkContract(contractId),
        topic: input.scvalTopics,
        value: input.scvalValue,
      }).amount,
      7n,
    );
    const filter = new EventFilter({
      topics: [SEP41Events.TransferEvent.toTopicFilter()],
    });
    assertEquals(filter.matchesTopics(input.scvalTopics), true);
    assertEquals(filter.toRawEventFilter().topics![0].at(-1), "**");
  });
  it("rejects conflated topic/value arms and malformed memo lengths", () => {
    for (
      const raw of [
        nativeToScVal(7n, { type: "u64" }),
        record([["amount", nativeToScVal(7n, { type: "u64" })]]),
        record([["amount", amount], [
          "to_muxed_id",
          nativeToScVal(-1n, { type: "i64" }),
        ]]),
        record([["amount", amount], [
          "to_muxed_id",
          xdr.ScVal.scvBytes(new Uint8Array(31)),
        ]]),
      ]
    ) assertEquals(SEP41Events.TransferEvent.is(event(raw, topics)), false);
    assertEquals(
      SEP41Events.TransferEvent.is(
        event(amount, [xdr.ScVal.scvString("transfer"), address, address]),
      ),
      false,
    );
    assertEquals(
      SEP41Events.TransferEvent.is(
        event(amount, [
          topics[0],
          xdr.ScVal.scvString(
            "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
          ),
          address,
        ]),
      ),
      false,
    );
  });
  it("requires u32 approval expiry and i128 amounts in both accepted representations", () => {
    const approveTopics = [xdr.ScVal.scvSymbol("approve"), address, address];
    for (
      const expiry of [xdr.ScVal.scvI32(7), nativeToScVal(7n, { type: "u64" })]
    ) {
      for (
        const value of [
          xdr.ScVal.scvVec([amount, expiry]),
          record([["amount", amount], ["live_until_ledger", expiry]]),
        ]
      ) {
        const input = event(value, approveTopics);
        assertEquals(SEP41Events.ApproveEvent.is(input), false);
        assertEquals(SEP41Events.ApproveEvent.tryFromEvent(input), undefined);
        assertThrows(() => SEP41Events.ApproveEvent.fromEvent(input));
      }
    }
  });
  it("accepts absent, void, u64 and historical string/32-byte muxed data", () => {
    for (
      const muxed of [
        undefined,
        xdr.ScVal.scvVoid(),
        nativeToScVal(1n, { type: "u64" }),
        xdr.ScVal.scvString("memo"),
        xdr.ScVal.scvBytes(new Uint8Array(32)),
      ]
    ) {
      const fields: [string, xdr.ScVal][] = [["amount", amount]];
      if (muxed) fields.push(["to_muxed_id", muxed]);
      assertEquals(
        SEP41Events.TransferEvent.is(event(record(fields), topics)),
        true,
      );
    }
  });
});
