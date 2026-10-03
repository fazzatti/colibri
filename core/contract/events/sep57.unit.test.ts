import { assertEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  contractId,
  eventEntry,
} from "colibri-internal/tests/binding-fixtures.ts";
import { option } from "colibri-internal/tests/soroban-values-fixtures.ts";
import { Address, nativeToScVal, xdr } from "stellar-sdk";
import { Spec } from "stellar-sdk/contract";
import { ContractEventRegistry } from "@/contract/events/index.ts";
import * as ERROR from "@/contract/events/error.ts";
import { Event } from "@/event/event.ts";
import { EventType } from "@/event/types.ts";
import { SEP41Events } from "@/event/standards/sep41/index.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const topic = (name: string) =>
  new xdr.ScSpecEventParamV0({
    name,
    doc: "",
    type: xdr.ScSpecTypeDef.scSpecTypeAddress(),
    location: xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationTopicList,
  });
const data = (name: string, type: xdr.ScSpecTypeDef) =>
  new xdr.ScSpecEventParamV0({
    name,
    doc: "",
    type,
    location: xdr.ScSpecEventParamLocationV0.scSpecEventParamLocationData,
  });
// SEP-57 0.4.0 declarations, including the shared transfer topic and Option<u64>.
const spec = new Spec([
  eventEntry(undefined, "Transfer", [
    topic("from"),
    topic("to"),
    data("amount", xdr.ScSpecTypeDef.scSpecTypeI128()),
  ], ["transfer"]),
  eventEntry(undefined, "MuxedTransfer", [
    topic("from"),
    topic("to"),
    data("to_muxed_id", option(xdr.ScSpecTypeDef.scSpecTypeU64())),
    data("amount", xdr.ScSpecTypeDef.scSpecTypeI128()),
  ], ["transfer"]),
]);
const address = new Address(
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
).toScVal();
const amount = nativeToScVal(7n, { type: "i128" });
const entry = (key: string, val: xdr.ScVal) =>
  new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val });
const event = (value: xdr.ScVal) =>
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
    topic: [xdr.ScVal.scvSymbol("transfer"), address, address],
  });

describe("SEP-57 muxed event compatibility", () => {
  it("accepts dense and sparse Option<u64> while retaining ambiguous transfer declarations", () => {
    const registry = new ContractEventRegistry(spec);
    for (
      const muxed of [
        undefined,
        xdr.ScVal.scvVoid(),
        nativeToScVal(42n, { type: "u64" }),
      ]
    ) {
      const input = event(
        xdr.ScVal.scvMap([
          entry("amount", amount),
          ...(muxed ? [entry("to_muxed_id", muxed)] : []),
        ]),
      );
      const parsed = registry.get("MuxedTransfer").fromEvent(input);
      assertEquals(parsed.fields.amount, 7n);
      assertEquals(
        parsed.fields.to_muxed_id,
        muxed?.type === "scvU64" ? 42n : null,
      );
      assertEquals(parsed.scvalValue.toXdr(), input.scvalValue.toXdr());
      assertThrows(() => registry.parse(input), ERROR.AMBIGUOUS_EVENT);
    }
  });
  it("keeps the narrow SEP-57 field distinct from SEP-41 historical memo representations", () => {
    const definition = new ContractEventRegistry(spec).get("MuxedTransfer");
    for (
      const raw of [
        xdr.ScVal.scvString("memo"),
        xdr.ScVal.scvBytes(new Uint8Array(32)),
      ]
    ) {
      const input = event(
        xdr.ScVal.scvMap([entry("amount", amount), entry("to_muxed_id", raw)]),
      );
      assertEquals(definition.is(input), false);
      assertEquals(SEP41Events.TransferEvent.is(input), true);
    }
    for (
      const value of [
        xdr.ScVal.scvMap([]),
        xdr.ScVal.scvMap([entry("amount", xdr.ScVal.scvU32(7))]),
      ]
    ) assertEquals(definition.is(event(value)), false);
  });
  it("offers explicit strict diagnostics without changing default sparse acceptance", () => {
    const strict = new ContractEventRegistry(spec, { dataFields: "strict" });
    const sparse = event(xdr.ScVal.scvMap([entry("amount", amount)]));
    assertEquals(strict.parse(sparse)!.fields.amount, 7n);
    assertEquals(strict.get("MuxedTransfer").is(sparse), false);
    const dense = event(
      xdr.ScVal.scvMap([
        entry("amount", amount),
        entry("to_muxed_id", xdr.ScVal.scvVoid()),
      ]),
    );
    assertEquals(strict.parse(dense)!.fields.to_muxed_id, null);
  });
});
