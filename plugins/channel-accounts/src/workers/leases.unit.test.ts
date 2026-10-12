import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { ChannelWorkerLeases } from "@/workers/leases.ts";
import * as ERROR from "@/shared/error.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("Channel worker ownership", () => {
  it("uses the first available account and hands a released lease to the oldest waiter", async () => {
    const pool = new ChannelWorkerLeases(["a", "b"], 4);
    assertEquals(await pool.acquire("1"), "a");
    assertEquals(await pool.acquire("2"), "b");
    const third = pool.acquire("3");
    const fourth = pool.acquire("4");
    pool.release("2");
    assertEquals(await third, "b");
    pool.release("1");
    assertEquals(await fourth, "a");
    pool.release("3");
    pool.release("4");
    pool.release("missing");
    assertEquals(pool.snapshot(), [{ address: "a", state: "available" }, {
      address: "b",
      state: "available",
    }]);
  });

  it("bounds active and waiting requests and snapshots defensively", async () => {
    const pool = new ChannelWorkerLeases(["a"], 2);
    await pool.acquire("1");
    const waiting = pool.acquire("2");
    const error = await assertRejects(
      () => pool.acquire("3"),
      ERROR.CHANNEL_WORKER_CAPACITY,
    );
    assertEquals(error.meta?.data, { maxPending: 2 });
    const snapshot = pool.snapshot();
    Object.assign(snapshot[0], { state: "available" });
    assertEquals(pool.snapshot()[0].state, "busy");
    pool.release("1");
    await waiting;
    pool.release("2");
  });

  it("quarantines a failed channel while other healthy accounts continue", async () => {
    const pool = new ChannelWorkerLeases(["a", "b"], 3);
    await pool.acquire("1");
    await pool.acquire("2");
    const waiting = pool.acquire("3");
    const expected = new Error("uncertain outcome");
    pool.release("1", expected);
    assertStrictEquals(pool.snapshot()[0].error, expected);
    pool.release("2");
    assertEquals(await waiting, "b");
    pool.release("3");
    assertEquals(await pool.acquire("4"), "b");
    pool.release("4");
  });

  it("rejects pending and future requests when every channel is quarantined", async () => {
    const pool = new ChannelWorkerLeases(["a"], 3);
    await pool.acquire("1");
    const waiting = assertRejects(
      () => pool.acquire("2"),
      ERROR.CHANNELS_UNAVAILABLE,
    );
    pool.release("1", new Error("uncertain outcome"));
    await waiting;
    await assertRejects(() => pool.acquire("3"), ERROR.CHANNELS_UNAVAILABLE);
  });

  it("closes admission and waiters while active leases finish normally", async () => {
    const pool = new ChannelWorkerLeases(["a"], 2);
    await pool.acquire("1");
    const waiting = assertRejects(
      () => pool.acquire("2"),
      ERROR.CHANNEL_WORKERS_CLOSED,
    );
    pool.close();
    pool.close();
    await waiting;
    await assertRejects(() => pool.acquire("3"), ERROR.CHANNEL_WORKERS_CLOSED);
    pool.release("1");
    assertEquals(pool.snapshot()[0].state, "available");
  });

  it("does not reuse an interrupted active account even after late successful cleanup", async () => {
    const pool = new ChannelWorkerLeases(["a", "b"], 2);
    await pool.acquire("1");
    pool.interrupt();
    pool.release("1");
    assertEquals(pool.snapshot().map((channel) => channel.state), [
      "quarantined",
      "available",
    ]);
  });
});
