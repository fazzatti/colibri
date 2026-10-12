import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { LocalSigner, NativeAccount } from "@colibri/core";
import { WorkerError } from "convee/workers";
import { createChannelAccountsWorker } from "@/workers/definition.ts";
import { createChannelAccountsParallel } from "@/workers/parallel.ts";
import * as ERROR from "@/shared/error.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const channel = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
const definition = createChannelAccountsWorker(
  () => ({ channel, run: (value: number) => value + 1 }),
  { module: import.meta.url },
);

describe("Channel parallel configuration and admission", () => {
  it("releases admission if close starts after allocation but before dispatch", async () => {
    let created = 0;
    const owner = createChannelAccountsParallel({
      channels: [channel.address()],
      worker: definition,
      createWorker: () => {
        created++;
        throw new Error("must not dispatch");
      },
    });
    const rejected = assertRejects(
      () => owner.step(1),
      ERROR.CHANNEL_WORKER_FAILED,
    );
    while (owner.getChannels()[0].state !== "busy") await Promise.resolve();
    const closing = owner.close();
    const error = await rejected;
    assertEquals(error.meta?.data, {
      address: channel.address(),
      quarantined: false,
    });
    await closing;
    assertEquals(created, 0);
    assertEquals(owner.getChannels()[0].state, "available");
  });

  it("retires a group made unavailable by failed preloading", async () => {
    await using owner = createChannelAccountsParallel({
      channels: [channel.address()],
      worker: definition,
      createWorker: () => {
        throw new Error("preload unavailable");
      },
    });
    await assertRejects(() => owner.ready(), WorkerError);
    const failure = await assertRejects(
      () => owner.step(1),
      ERROR.CHANNEL_WORKER_FAILED,
    );
    assertEquals(failure.meta?.data, {
      address: channel.address(),
      quarantined: false,
    });
    assertEquals(owner.getChannels()[0].state, "unavailable");
  });
  it("rejects invalid addresses, duplicate ownership and invalid queue limits", () => {
    assertThrows(
      () => createChannelAccountsParallel(null as never),
      ERROR.INVALID_WORKER_CONFIGURATION,
    );
    for (
      const channels of [[], ["invalid"], [1 as never], [
        channel.address(),
        channel.address(),
      ]]
    ) {
      assertThrows(
        () => createChannelAccountsParallel({ channels, worker: definition }),
        ERROR.INVALID_WORKER_CONFIGURATION,
      );
    }
    for (
      const maxPending of [
        0,
        -1,
        0.5,
        NaN,
        Infinity,
        Number.MAX_SAFE_INTEGER + 1,
      ]
    ) {
      assertThrows(
        () =>
          createChannelAccountsParallel({
            channels: [channel.address()],
            worker: definition,
            maxPending,
          }),
        ERROR.INVALID_WORKER_CONFIGURATION,
      );
    }
    assertThrows(
      () =>
        createChannelAccountsParallel({
          channels: [channel.address()],
          worker: definition,
          timeoutMs: 0,
        }),
      WorkerError,
    );
  });

  it("closes inert owners idempotently and never initializes or restarts them", async () => {
    const owner = createChannelAccountsParallel({
      channels: [channel.address()],
      worker: definition,
    });
    const closed = owner.close();
    assertStrictEquals(owner.close(), closed);
    assertStrictEquals(owner.dispose(), closed);
    await owner[Symbol.asyncDispose]();
    await assertRejects(() => owner.step(1), ERROR.CHANNEL_WORKERS_CLOSED);
    await assertRejects(() => owner.ready(), ERROR.CHANNEL_WORKERS_CLOSED);
    await owner.terminate();
    await owner.terminate();
  });

  it("rejects non-cloneable payloads before acquiring an account or transport", async () => {
    let created = 0;
    await using owner = createChannelAccountsParallel({
      channels: [channel.address()],
      worker: definition,
      createWorker: () => {
        created++;
        throw new Error("must not start");
      },
    });
    await assertRejects(
      () => owner.step((() => {}) as never),
      ERROR.INVALID_WORKER_PAYLOAD,
    );
    assertEquals(created, 0);
    assertEquals(owner.getChannels()[0].state, "available");
  });

  it("reports startup failure without retrying or quarantining an undispatched account", async () => {
    let attempts = 0;
    await using owner = createChannelAccountsParallel({
      channels: [channel.address()],
      worker: definition,
      createWorker: () => {
        attempts++;
        throw new Error("transport unavailable");
      },
    });
    const error = await assertRejects(
      () => owner.step(1),
      ERROR.CHANNEL_WORKER_FAILED,
    );
    assertEquals(error.meta?.data, {
      address: channel.address(),
      quarantined: false,
    });
    assertEquals(owner.getChannels()[0].state, "unavailable");
    await assertRejects(() => owner.step(2), ERROR.CHANNELS_UNAVAILABLE);
    assertEquals(attempts, 1);
  });
});
