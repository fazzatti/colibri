import { assertEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import evidence from "colibri-internal/tests/protocol-28-events.json" with {
  type: "json",
};
import {
  Protocol28,
  State,
} from "colibri-internal/tests/generated-bindings/protocol-28/index.ts";
import { Protocol28Spec } from "colibri-internal/tests/generated-bindings/protocol-28/constants.ts";
import { xdr } from "stellar-sdk";
import { NetworkConfig } from "@/network/index.ts";
import { ContractEventRegistry } from "@/contract/events/index.ts";
import {
  decodeSorobanResult,
  encodeSorobanArguments,
} from "@/contract/encoding/index.ts";
import { Event } from "@/event/event.ts";
import { EventType } from "@/event/types.ts";
import * as ERROR from "@/contract/events/error.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const events = evidence.events.map(({ topics, data }, index) => {
  const topic = xdr.ScVal.fromXdr(topics, "hex");
  if (topic.type !== "scvVec" || !topic.value) {
    throw new Error("Invalid Rust evidence");
  }
  return new Event({
    id: `0000000042949672960-000000000${index}`,
    type: EventType.Contract,
    ledger: 10,
    ledgerClosedAt: "2026-01-01T00:00:00Z",
    transactionIndex: 1,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: "ab".repeat(32),
    contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    topic: topic.value,
    value: xdr.ScVal.fromXdr(data, "hex"),
  });
});
describe("Rust SDK 28 independent wire fixtures", () => {
  it("decodes sparse and dense emitted events through the generated client", () => {
    const client = new Protocol28({
      networkConfig: NetworkConfig.TestNet(),
      contractConfig: {
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
      },
    });
    const registry = client.events;
    for (const event of events.slice(0, 2)) {
      assertEquals(registry.get("SparseUpdate").fromEvent(event).fields, {
        a: null,
        b: 7,
      });
      assertEquals(registry.get("DenseUpdate").fromEvent(event).fields, {
        a: null,
        b: 7,
      });
      assertThrows(() => registry.parse(event), ERROR.AMBIGUOUS_EVENT);
    }
    const strict = new ContractEventRegistry(Protocol28Spec, {
      dataFields: "strict",
    });
    assertEquals(strict.get("SparseUpdate").is(events[0]), false);
    assertEquals(strict.get("DenseUpdate").is(events[1]), true);
  });
  it("preserves real Transfer/MuxedTransfer ambiguity and Option<u64>", () => {
    const registry = new ContractEventRegistry(Protocol28Spec);
    for (const [index, event] of events.slice(2).entries()) {
      const decoded = registry.get("MuxedTransfer").fromEvent(event);
      assertEquals(decoded.fields.to_muxed_id, index === 3 ? 42n : null);
      assertEquals(decoded.fields.amount, 7n);
      assertEquals(decoded.scvalValue.toXdr(), event.scvalValue.toXdr());
      assertThrows(() => registry.parse(event), ERROR.AMBIGUOUS_EVENT);
    }
  });
  it("uses generated optional inputs and decodes the actual Rust struct spec by name", () => {
    assertEquals(State.from({ b: 7 }).value, { a: null, b: 7, c: null });
    const dense =
      encodeSorobanArguments(Protocol28Spec, "echo", { state: { b: 7 } })[0];
    assertEquals(decodeSorobanResult(Protocol28Spec, "echo", dense), {
      a: null,
      b: 7,
      c: null,
    });
    // The emitted sparse map has exactly the required State field b.
    assertEquals(
      decodeSorobanResult(Protocol28Spec, "echo", events[0].scvalValue),
      { a: null, b: 7, c: null },
    );
  });
});
