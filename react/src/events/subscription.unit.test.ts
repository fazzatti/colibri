import * as xdr from "stellar-sdk/xdr";
import { assertEquals, assertThrows } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { stub } from "@std/testing/mock";
import { type LiveStartOptions, RPCStreamer } from "@colibri/rpc-streamer";
import {
  createEventIdFromParts,
  Event,
  EventType,
  NetworkConfig,
} from "@colibri/core";
import { createColibriConfig } from "@/context/config.ts";
import { createContractEvents } from "@/events/subscription.ts";
import { ColibriReactError } from "@/errors/index.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const event = (index: number) =>
  new Event({
    id: createEventIdFromParts(1, 1, 1, index),
    type: EventType.Contract,
    ledger: 1,
    ledgerClosedAt: new Date(0).toISOString(),
    transactionIndex: 0,
    operationIndex: 0,
    inSuccessfulContractCall: true,
    txHash: "a".repeat(64),
    topic: [],
    value: xdr.ScVal.scvVoid(),
  });
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
describe("shared event subscriptions", () => {
  it("does not start a deferred streamer after immediate unmount", async () => {
    const config = createColibriConfig({ network: NetworkConfig.TestNet() });
    using factory = stub(RPCStreamer, "event", () => {
      throw new Error("Unmounted stream must never start");
    });
    const events = createContractEvents(config);
    const stop = events.subscribe(() => {});
    stop();
    await tick();
    assertEquals(factory.calls.length, 0);
    assertEquals(events.getSnapshot().status, "idle");
    events.destroy();
    config.destroy();
  });
  it("shares one streamer, bounds and deduplicates events, ignores late callbacks", async () => {
    const config = createColibriConfig({ network: NetworkConfig.TestNet() });
    let deliver!: (event: Event) => void;
    let signal!: AbortSignal;
    let resolveRun!: () => void;
    using factory = stub(RPCStreamer, "event", () => ({
      startLive: (handler: typeof deliver, options: LiveStartOptions) => {
        deliver = handler;
        signal = options.signal!;
        return new Promise<void>((resolve) => {
          resolveRun = resolve;
          signal.addEventListener("abort", () => resolve(), { once: true });
        });
      },
    } as unknown as ReturnType<typeof RPCStreamer.event>));
    const events = createContractEvents(config, { maxEvents: 2 });
    assertEquals(events.getServerSnapshot().status, "idle");
    const first = events.subscribe(() => {});
    const second = events.subscribe(() => {});
    await tick();
    assertEquals(factory.calls.length, 1);
    for (const id of [1, 2, 2, 3]) deliver(event(id));
    assertEquals(events.getSnapshot().events.map((x) => x.id), [
      event(2).id,
      event(3).id,
    ]);
    first();
    assertEquals(signal.aborted, false);
    second();
    assertEquals(signal.aborted, true);
    deliver(event(4));
    assertEquals(events.getSnapshot().events.length, 2);
    await tick();
    const third = events.subscribe(() => {});
    await tick();
    assertEquals(factory.calls.length, 2);
    resolveRun();
    await tick();
    assertEquals(events.getSnapshot().status, "complete");
    third();
    events.destroy();
    config.destroy();
  });
  it("reports failure and only retries explicitly", async () => {
    const config = createColibriConfig({ network: NetworkConfig.TestNet() });
    const error = new Error("RPC");
    using factory = stub(
      RPCStreamer,
      "event",
      () => ({
        startLive: () => Promise.reject(error),
      } as unknown as ReturnType<typeof RPCStreamer.event>),
    );
    const events = createContractEvents(config);
    const stop = events.subscribe(() => {});
    await tick();
    assertEquals(events.getSnapshot().error, error);
    assertEquals(factory.calls.length, 1);
    events.restart();
    await tick();
    assertEquals(factory.calls.length, 2);
    stop();
    events.destroy();
    config.destroy();
  });
  it("rejects invalid bounds", () => {
    const config = createColibriConfig({ network: NetworkConfig.TestNet() });
    for (const maxEvents of [0, -1, Infinity, 1.5]) {
      assertThrows(
        () => createContractEvents(config, { maxEvents }),
        ColibriReactError,
      );
    }
    config.destroy();
  });
});
