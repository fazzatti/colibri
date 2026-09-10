import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Spec } from "stellar-sdk/contract";
import { Address, StrKey, xdr } from "stellar-sdk";
import {
  ContractEvent,
  contractEventBindings,
  ContractEventDefinition,
  ContractEventRegistry,
  extractContractEventsFromSpec,
  extractContractEventsFromWasm,
} from "@/contract/events/index.ts";
import {
  SorobanError,
  SorobanString,
  SorobanSymbol,
} from "@/soroban-types/values/primitives.ts";
import * as E from "@/contract/events/error.ts";
import { validateEventValue } from "@/contract/events/codec.ts";
import { Contract } from "@/contract/index.ts";
import { NetworkConfig } from "@/network/index.ts";
import { Event } from "@/event/event.ts";
import { EventType } from "@/event/types.ts";
import {
  amount,
  bindingSpec,
  contractId,
  eventEntry,
  symbol,
} from "colibri-internal/tests/binding-fixtures.ts";

function event(
  value: xdr.ScVal = xdr.ScVal.scvMap([
    new xdr.ScMapEntry({ key: symbol("amount"), val: amount() }),
  ]),
  topic: xdr.ScVal[] = [symbol("transfer"), symbol("alice")],
): Event {
  return new Event({
    id: "0000000042949672960-0000000001",
    type: EventType.Contract,
    ledger: 10,
    ledgerClosedAt: "2026-01-01T00:00:00Z",
    transactionIndex: 1,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: "ab".repeat(32),
    contractId,
    topic,
    value,
  });
}
describe("spec-aware contract events", () => {
  for (
    const [name, type] of [
      ["Address", xdr.ScSpecTypeDef.scSpecTypeAddress()],
      ["MuxedAddress", xdr.ScSpecTypeDef.scSpecTypeMuxedAddress()],
    ] as const
  ) {
    it(`decodes and filters the supported ${name} address variants`, () => {
      const entry = eventEntry();
      assert(entry.type === "scSpecEntryEventV0");
      const declaration = new xdr.ScSpecEventV0({
        ...entry.value,
        params: entry.value.params.map((param) =>
          new xdr.ScSpecEventParamV0({ ...param, type })
        ),
      });
      const definition = new ContractEventDefinition(
        new Spec([xdr.ScSpecEntry.scSpecEntryEventV0(declaration)]),
        declaration,
      );
      const account = StrKey.encodeEd25519PublicKey(new Uint8Array(32));
      const muxed = StrKey.encodeMed25519PublicKey(
        Uint8Array.from([...new Uint8Array(39), 7]),
      );
      for (const address of [account, contractId, muxed]) {
        const value = new Address(address).toScVal();
        const occurrence = event(
          xdr.ScVal.scvMap([
            new xdr.ScMapEntry({ key: symbol("amount"), val: value }),
          ]),
          [symbol("transfer"), value],
        );
        if (name === "Address" && address === muxed) {
          assertThrows(() => definition.fromEvent(occurrence), E.DECODE_FAILED);
          assertEquals(definition.tryFromEvent(occurrence), undefined);
          assertThrows(
            () => definition.toEventFilter({ owner: address }),
            E.INVALID_FILTER,
          );
        } else {
          assertEquals(definition.fromEvent(occurrence).fields, {
            owner: address,
            amount: address,
          });
          assert(
            definition.toEventFilter({ owner: address }).matchesTopics(
              occurrence.scvalTopics,
            ),
          );
        }
      }
    });
  }
  for (
    const [format, value] of [
      [
        xdr.ScSpecEventDataFormat.scSpecEventDataFormatMap,
        xdr.ScVal.scvMap([
          new xdr.ScMapEntry({ key: symbol("amount"), val: amount() }),
        ]),
      ],
      [
        xdr.ScSpecEventDataFormat.scSpecEventDataFormatVec,
        xdr.ScVal.scvVec([amount()]),
      ],
      [xdr.ScSpecEventDataFormat.scSpecEventDataFormatSingleValue, amount()],
    ] as const
  ) {
    it(`decodes ${format.name} and retains metadata`, () => {
      const registry = extractContractEventsFromSpec(
        new Spec([eventEntry(format)]),
        { contractId },
      );
      const input = event(value);
      const definition = registry.get("Transfer");
      const parsed = definition.fromEvent(input);
      assertInstanceOf(parsed, ContractEvent);
      assertEquals(parsed.get("amount"), 42n);
      assertEquals(parsed.fields.owner, "alice");
      assertEquals(parsed.txHash, input.txHash);
      assertEquals(parsed.id, input.id);
      assertEquals(parsed.scvalValue.toXdr(), input.scvalValue.toXdr());
      assertEquals(registry.parse(input)?.fields, parsed.fields);
      assert(definition.is(input));
      const filter = definition.toEventFilter({ owner: "alice" });
      assert(filter.matchesTopics(input.scvalTopics));
      assertEquals(
        definition.toTopicFilter({ owner: new SorobanSymbol("alice") }),
        definition.toTopicFilter({ owner: "alice" }),
      );
      assertThrows(
        () => definition.toTopicFilter({ owner: new SorobanString("alice") }),
        E.INVALID_FILTER,
      );
      assertEquals(definition.toTopicFilter()[1], "*");
      if (format === xdr.ScSpecEventDataFormat.scSpecEventDataFormatVec) {
        for (const invalid of [amount(), xdr.ScVal.scvVec([])]) {
          assertThrows(
            () => definition.fromEvent(event(invalid)),
            E.DECODE_FAILED,
          );
        }
      }
      assertThrows(
        () => definition.toTopicFilter({ amount: 1 }),
        E.INVALID_FILTER,
      );
      assertThrows(
        () => definition.toTopicFilter({ owner: 1 }),
        E.INVALID_FILTER,
      );
    });
  }
  it("decodes errors and filters new error-value types", () => {
    const declaration = eventEntry();
    assert(declaration.type === "scSpecEntryEventV0");
    const error = xdr.ScSpecTypeDef.scSpecTypeError();
    const params = declaration.value.params.map((param) =>
      new xdr.ScSpecEventParamV0({ ...param, type: error })
    );
    const definition = new ContractEventDefinition(
      new Spec([declaration]),
      new xdr.ScSpecEventV0({ ...declaration.value, params }),
    );
    const value = new SorobanError({ type: "sceContract", code: 7 });
    const occurrence = event(
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({ key: symbol("amount"), val: value.toScVal() }),
      ]),
      [symbol("transfer"), value.toScVal()],
    );
    assertEquals(definition.fromEvent(occurrence).fields, {
      owner: value.value,
      amount: value.value,
    });
    assert(
      definition.toEventFilter({ owner: value }).matchesTopics(
        occurrence.scvalTopics,
      ),
    );
    assertEquals(definition.toTopicFilter()[1], "*");
  });
  it("rejects partial, mistyped, extra and ambiguous occurrences", () => {
    const spec = bindingSpec();
    const definition = new ContractEventRegistry(spec, { contractId }).get(
      "Transfer",
    );
    for (
      const invalid of [
        event(xdr.ScVal.scvMap([])),
        event(xdr.ScVal.scvMap([
          new xdr.ScMapEntry({ key: symbol("wrong_field"), val: amount() }),
        ])),
        event(
          xdr.ScVal.scvMap([
            new xdr.ScMapEntry({
              key: symbol("amount"),
              val: xdr.ScVal.scvU32(42),
            }),
          ]),
        ),
        event(undefined, [symbol("wrong"), symbol("alice")]),
        event(undefined, [xdr.ScVal.scvString("transfer"), symbol("alice")]),
        event(undefined, [
          symbol("transfer"),
          symbol("alice"),
          symbol("extra"),
        ]),
      ]
    ) {
      assertEquals(definition.tryFromEvent(invalid), undefined);
      assertThrows(() => definition.fromEvent(invalid), E.DECODE_FAILED);
    }
    const foreign = event();
    foreign.contractId = undefined;
    assertEquals(definition.tryFromEvent(foreign), undefined);
    const system = event();
    system.type = EventType.System;
    assertEquals(definition.is(system), false);
    const ambiguous = new ContractEventRegistry(
      new Spec([eventEntry(), eventEntry()]),
    );
    assertThrows(() => ambiguous.parse(event()), E.AMBIGUOUS_EVENT);
    assertEquals(ambiguous.bindings.map((item) => item.key), [
      "Transfer",
      "Transfer_2",
    ]);
    assertEquals(ambiguous.get("Transfer", 1).occurrence, 1);
    assertThrows(() => ambiguous.get("missing"), E.UNKNOWN_EVENT);
    assertEquals(ambiguous.parse(system), undefined);
  });
  it("handles collisions, topicless events and empty registries", () => {
    const spec = new Spec([
      eventEntry(undefined, "get"),
      eventEntry(undefined, "get_2"),
      eventEntry(undefined, "__proto__"),
      eventEntry(undefined, "1-x"),
    ]);
    assertEquals(contractEventBindings(spec).map((item) => item.key), [
      "get_2",
      "get_2_2",
      "__proto___2",
      "_1_x",
    ]);
    const registry = new ContractEventRegistry(
      new Spec([
        eventEntry(
          xdr.ScSpecEventDataFormat.scSpecEventDataFormatVec,
          "Empty",
          [],
          [],
        ),
      ]),
    );
    const empty = event(xdr.ScVal.scvVec([]), []);
    assertEquals(registry.get("Empty").fromEvent(empty).fields, {});
    assertEquals(registry.get("Empty").toTopicFilter(), ["**"]);
    assert(
      registry.get("Empty").toEventFilter().matchesTopics(empty.scvalTopics),
    );
    assertEquals(
      new ContractEventRegistry(
        new Spec(
          bindingSpec().entries.filter((entry) =>
            entry.type === "scSpecEntryFunctionV0"
          ),
        ),
      ).list(),
      [],
    );
  });
  it("validates declarations and snapshots a registry independently", () => {
    const entry = eventEntry();
    assert(entry.type === "scSpecEntryEventV0");
    const params = entry.value.params;
    assertThrows(
      () =>
        new ContractEventDefinition(
          new Spec([entry]),
          new xdr.ScSpecEventV0({
            ...entry.value,
            prefixTopics: ["one", "two", "three", "four"],
          }),
        ),
      E.INVALID_SPEC,
      "too many topics",
    );
    assertThrows(
      () =>
        new ContractEventDefinition(
          new Spec(
            bindingSpec().entries.filter((entry) =>
              entry.type === "scSpecEntryFunctionV0"
            ),
          ),
          new xdr.ScSpecEventV0({
            ...entry.value,
            params: [...params, params[0]],
          }),
        ),
      E.INVALID_SPEC,
    );
    assertThrows(
      () =>
        new ContractEventDefinition(
          new Spec(
            bindingSpec().entries.filter((entry) =>
              entry.type === "scSpecEntryFunctionV0"
            ),
          ),
          new xdr.ScSpecEventV0({
            ...entry.value,
            params: [],
            dataFormat:
              xdr.ScSpecEventDataFormat.scSpecEventDataFormatSingleValue,
          }),
        ),
      E.INVALID_SPEC,
    );
    const spec = bindingSpec();
    const registry = new ContractEventRegistry(spec);
    spec.entries.length = 0;
    assertEquals(
      registry.get("Transfer").fromEvent(event()).get("amount"),
      42n,
    );
  });
  it("loads local Wasm and reuses Contract registry until the spec changes", async () => {
    const wasm = await Deno.readFile(
      "_internal/tests/compiled-contracts/fungible_token_contract.wasm",
    );
    assertEquals(extractContractEventsFromWasm(wasm).list(), []);
    const contract = new Contract({
      networkConfig: NetworkConfig.TestNet(),
      contractConfig: { wasm },
    });
    assertThrows(() => contract.events);
    const registry = await contract.loadContractEventsFromWasm();
    assertStrictEquals(contract.events, registry);
    assertStrictEquals(await contract.loadContractEventsFromWasm(), registry);
    await contract.loadSpecFromWasm();
    assert(contract.events !== registry);
  });
  it("validates nested containers and fixed-size values before decoding", () => {
    const spec = bindingSpec();
    const u32 = xdr.ScSpecTypeDef.scSpecTypeU32();
    const vec = xdr.ScSpecTypeDef.scSpecTypeVec(
      new xdr.ScSpecTypeVec({ elementType: u32 }),
    );
    const tuple = xdr.ScSpecTypeDef.scSpecTypeTuple(
      new xdr.ScSpecTypeTuple({ valueTypes: [u32] }),
    );
    const map = xdr.ScSpecTypeDef.scSpecTypeMap(
      new xdr.ScSpecTypeMap({ keyType: u32, valueType: vec }),
    );
    validateEventValue(spec, xdr.ScVal.scvVec([xdr.ScVal.scvU32(1)]), vec);
    validateEventValue(spec, xdr.ScVal.scvVec([xdr.ScVal.scvU32(1)]), tuple);
    validateEventValue(
      spec,
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({
          key: xdr.ScVal.scvU32(1),
          val: xdr.ScVal.scvVec([]),
        }),
      ]),
      map,
    );
    validateEventValue(
      spec,
      xdr.ScVal.scvVoid(),
      xdr.ScSpecTypeDef.scSpecTypeOption(
        new xdr.ScSpecTypeOption({ valueType: u32 }),
      ),
    );
    validateEventValue(spec, symbol("any"), xdr.ScSpecTypeDef.scSpecTypeVal());
    assertThrows(
      () => validateEventValue(spec, xdr.ScVal.scvVec([]), tuple),
      E.INVALID_SPEC,
    );
    assertThrows(
      () => validateEventValue(spec, xdr.ScVal.scvVec(null), vec),
      E.INVALID_SPEC,
    );
    assertThrows(
      () => validateEventValue(spec, xdr.ScVal.scvMap(null), map),
      E.INVALID_SPEC,
    );
    assertThrows(
      () => validateEventValue(spec, xdr.ScVal.scvU32(1), u32, 65),
      E.INVALID_SPEC,
    );
    assertThrows(
      () =>
        validateEventValue(
          spec,
          xdr.ScVal.scvBytes(new Uint8Array(2)),
          xdr.ScSpecTypeDef.scSpecTypeBytesN(
            new xdr.ScSpecTypeBytesN({ n: 3 }),
          ),
        ),
      E.INVALID_SPEC,
    );
  });
});
