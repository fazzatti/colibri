import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { plugin } from "convee";
import definition, {
  addresses,
  type Receipt,
} from "colibri-internal/tests/helpers/channel-accounts/worker.ts";
import { createChannelAccountsParallel } from "@/workers/parallel.ts";
import * as ERROR from "@/shared/error.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const flag = () => new SharedArrayBuffer(4);
const release = (buffer: SharedArrayBuffer) =>
  Atomics.store(new Int32Array(buffer), 0, 1);
const waitPhase = async (buffer: SharedArrayBuffer, phase: number) => {
  const deadline = performance.now() + 5000;
  while (Atomics.load(new Int32Array(buffer), 0) !== phase) {
    if (performance.now() > deadline) {
      throw new Error(`Worker did not reach phase ${phase}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
};

describe("Real channel worker execution", () => {
  it("quarantines an actual worker crash while another account remains usable", async () => {
    await using owner = createChannelAccountsParallel({
      channels: addresses,
      worker: definition,
    });
    const failure = await assertRejects(
      () => owner.step({ crash: true }),
      ERROR.CHANNEL_WORKER_FAILED,
    );
    assertEquals(failure.meta?.data, {
      address: addresses[0],
      quarantined: true,
    });
    assertEquals(owner.getChannels()[0].state, "quarantined");
    assertEquals((await owner.step({})).address, addresses[1]);
  });

  it("does not quarantine successful remote work when a caller output hook fails", async () => {
    await using owner = createChannelAccountsParallel({
      channels: [addresses[0]],
      worker: definition,
    });
    const expected = new Error("caller rendering failed");
    const output = plugin().onOutput((_receipt: Receipt): Receipt => {
      throw expected;
    });
    assertStrictEquals(
      await assertRejects(
        () => owner.step.runWith({ plugins: [output] }, {}),
      ),
      expected,
    );
    assertEquals(owner.getChannels()[0].state, "available");
    assertEquals((await owner.step({})).executions, 2);
  });

  it("owns one account per worker and reuses its local pipeline without parallel account use", async () => {
    await using owner = createChannelAccountsParallel({
      channels: addresses,
      worker: definition,
    });
    await owner.ready();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => owner.step({ delayMs: 1 })),
    );
    assertEquals(new Set(results.map((result) => result.address)).size, 2);
    for (const address of addresses) {
      const own = results.filter((result) => result.address === address);
      assertEquals(
        own.map((result) => result.executions),
        own.map((_, index) => index + 1),
      );
      assertEquals(own.map((result) => result.source), own.map(() => address));
    }
  });

  it("holds a channel through worker-local pipeline finalization and applies backpressure", async () => {
    const phase = flag();
    const finalizerGate = flag();
    await using owner = createChannelAccountsParallel({
      channels: [addresses[0]],
      worker: definition,
      maxPending: 2,
    });
    const first = owner.step({ phase, finalizerGate });
    await waitPhase(phase, 2);
    const second = owner.step({});
    const capacity = await assertRejects(
      () => owner.step({}),
      ERROR.CHANNEL_WORKER_CAPACITY,
    );
    assertEquals(capacity.meta?.data, { maxPending: 2 });
    assertEquals(owner.getChannels()[0].state, "busy");
    release(finalizerGate);
    assertEquals((await first).executions, 1);
    assertEquals((await second).executions, 2);
  });

  it("uses a healthy available channel without waiting for an unrelated busy channel", async () => {
    const phase = flag();
    const gate = flag();
    await using owner = createChannelAccountsParallel({
      channels: addresses,
      worker: definition,
    });
    const slow = owner.step({ phase, gate });
    await waitPhase(phase, 1);
    const fast = await owner.step({});
    const another = await owner.step({});
    assertEquals(fast.address, another.address);
    assertEquals(another.executions, 2);
    release(gate);
    const completed = await slow;
    assertEquals(completed.address === fast.address, false);
  });

  it("quarantines uncertain task failures before caller recovery and never replays", async () => {
    const phase = flag();
    const gate = flag();
    await using owner = createChannelAccountsParallel({
      channels: [addresses[0]],
      worker: definition,
    });
    const fallback: Receipt = {
      address: "fallback",
      source: "fallback",
      executions: 0,
    };
    const recover = plugin({ id: "recover-caller" }).onError(() => fallback);
    const first = owner.step.runWith({ plugins: [recover] }, {
      phase,
      gate,
      fail: true,
    });
    await waitPhase(phase, 1);
    const waiting = assertRejects(
      () => owner.step({}),
      ERROR.CHANNELS_UNAVAILABLE,
    );
    release(gate);
    assertStrictEquals(await first, fallback);
    await waiting;
    assertEquals(owner.getChannels()[0].state, "quarantined");
    await assertRejects(() => owner.step({}), ERROR.CHANNELS_UNAVAILABLE);
  });

  it("keeps other accounts usable after a failed channel is quarantined", async () => {
    await using owner = createChannelAccountsParallel({
      channels: addresses,
      worker: definition,
    });
    await assertRejects(
      () => owner.step({ fail: true }),
      ERROR.CHANNEL_WORKER_FAILED,
    );
    const healthy = await owner.step({});
    assertEquals(healthy.address, addresses[1]);
    assertEquals(owner.getChannels().map((channel) => channel.state), [
      "quarantined",
      "available",
    ]);
  });

  it("quarantines an account when its result cannot be cloned", async () => {
    await using owner = createChannelAccountsParallel({
      channels: [addresses[0]],
      worker: definition,
    });
    const error = await assertRejects(
      () => owner.step({ uncloneable: true }),
      ERROR.CHANNEL_WORKER_FAILED,
    );
    assertEquals(error.meta?.data, {
      address: addresses[0],
      quarantined: true,
    });
    assertEquals(owner.getChannels()[0].state, "quarantined");
  });

  it("quarantines a timed-out request without replacing its worker or retrying it", async () => {
    await using owner = createChannelAccountsParallel({
      channels: [addresses[0]],
      worker: definition,
      timeoutMs: 30,
    });
    await owner.ready();
    const error = await assertRejects(
      () => owner.step({ hang: true }),
      ERROR.CHANNEL_WORKER_FAILED,
    );
    assertEquals(error.meta?.data, {
      address: addresses[0],
      quarantined: true,
    });
    await assertRejects(() => owner.step({}), ERROR.CHANNELS_UNAVAILABLE);
  });

  it("rejects queued work on close and drains an already executing request", async () => {
    const phase = flag();
    const gate = flag();
    const owner = createChannelAccountsParallel({
      channels: [addresses[0]],
      worker: definition,
    });
    const active = owner.step({ phase, gate });
    await waitPhase(phase, 1);
    const waiting = assertRejects(
      () => owner.step({}),
      ERROR.CHANNEL_WORKERS_CLOSED,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    let closed = false;
    const closing = owner.close().then(() => {
      closed = true;
    });
    await waiting;
    assertEquals(closed, false);
    release(gate);
    assertEquals((await active).executions, 1);
    await closing;
    await assertRejects(() => owner.step({}), ERROR.CHANNEL_WORKERS_CLOSED);
  });

  it("terminates active workers and preserves quarantine after late caller cleanup", async () => {
    const phase = flag();
    const owner = createChannelAccountsParallel({
      channels: [addresses[0]],
      worker: definition,
    });
    const active = assertRejects(
      () => owner.step({ phase, hang: true }),
      ERROR.CHANNEL_WORKER_FAILED,
    );
    await waitPhase(phase, 1);
    await owner.terminate();
    await active;
    assertEquals(owner.getChannels()[0].state, "quarantined");
    await owner.close();
    await assertRejects(() => owner.step({}), ERROR.CHANNEL_WORKERS_CLOSED);
  });

  it("snapshots queued payloads and keeps caller plugins in the caller", async () => {
    const phase = flag();
    const gate = flag();
    let outputs = 0;
    await using owner = createChannelAccountsParallel({
      channels: [addresses[0]],
      worker: definition,
      plugins: [
        plugin({ id: "caller-output" }).onOutput((receipt: Receipt) => {
          outputs++;
          return receipt;
        }),
      ],
    });
    const active = owner.step({ phase, gate });
    await waitPhase(phase, 1);
    const input = { fail: false };
    const queued = owner.step(input);
    await new Promise((resolve) => setTimeout(resolve, 0));
    input.fail = true;
    release(gate);
    await active;
    assertEquals((await queued).executions, 2);
    assertEquals(outputs, 2);
  });
});
