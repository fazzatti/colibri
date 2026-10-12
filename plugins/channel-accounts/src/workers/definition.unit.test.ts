import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { LocalSigner, NativeAccount } from "@colibri/core";
import { step } from "convee";
import { worker } from "convee/workers";
import {
  CHANNEL_WORKER_CONTEXT,
  channelWorkerDefinition,
  createChannelAccountsWorker,
  createChannelWorkerTask,
} from "@/workers/definition.ts";
import * as ERROR from "@/shared/error.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const account = () =>
  NativeAccount.fromMasterSigner(LocalSigner.generateRandom());

describe("Channel worker definitions", () => {
  it("supports a native worker declaration for build-tool entry discovery", () => {
    const channel = account();
    const definition = createChannelAccountsWorker(
      () => ({ channel, run: (input: number) => input + 1 }),
      (run) => worker(run, { module: import.meta.url }),
    );
    assertEquals(channelWorkerDefinition(definition).module, import.meta.url);
  });
  it("is import-safe and accepts only its own opaque definitions", () => {
    let initialized = false;
    const definition = createChannelAccountsWorker(() => {
      initialized = true;
      return { channel: account(), run: (value: number) => value + 1 };
    }, { module: import.meta.url });
    assertEquals(initialized, false);
    assertEquals(definition.module, import.meta.url);
    assertStrictEquals(channelWorkerDefinition(definition), definition);
    assertThrows(
      () => channelWorkerDefinition({ module: import.meta.url }),
      ERROR.INVALID_WORKER_CONFIGURATION,
    );
    assertThrows(
      () =>
        createChannelAccountsWorker(null as never, { module: import.meta.url }),
      ERROR.INVALID_WORKER_CONFIGURATION,
    );
    assertThrows(
      () =>
        createChannelAccountsWorker(() => ({ channel: account(), run() {} }), {
          module: "relative.ts",
        }),
      ERROR.INVALID_WORKER_CONFIGURATION,
    );
  });

  it("initializes once, keeps tuple inputs and binds one account for its lifetime", async () => {
    const channel = account();
    let initialized = 0;
    const run = step(createChannelWorkerTask(async (address) => {
      initialized++;
      assertEquals(address, channel.address());
      await Promise.resolve();
      return {
        channel,
        run: (left: number, right: string) => `${left}:${right}`,
      };
    }));
    const options = {
      context: { seed: { [CHANNEL_WORKER_CONTEXT]: channel.address() } },
    };
    assertEquals(
      await run.runWith(options, {
        address: channel.address(),
        input: [3, "a"],
      }),
      "3:a",
    );
    assertEquals(
      await run.runWith(options, {
        address: channel.address(),
        input: [4, "b"],
      }),
      "4:b",
    );
    assertEquals(initialized, 1);
    const other = account().address();
    await assertRejects(
      () =>
        run.runWith(
          { context: { seed: { [CHANNEL_WORKER_CONTEXT]: other } } },
          { address: other, input: [0, "c"] },
        ),
      ERROR.CHANNEL_BINDING_MISMATCH,
    );
  });

  it("rejects a missing or changed address envelope before initialization", async () => {
    const channel = account();
    let initialized = false;
    const run = step(createChannelWorkerTask(() => {
      initialized = true;
      return { channel, run() {} };
    }));
    await assertRejects(
      () => run({ address: channel.address(), input: [] }),
      ERROR.CHANNEL_BINDING_MISMATCH,
    );
    assertEquals(initialized, false);
  });

  it("rejects a loader returning a different account without running its task", async () => {
    const expected = account();
    const actual = account();
    const run = step(createChannelWorkerTask(() => ({
      channel: actual,
      run() {
        throw new Error("must not execute");
      },
    })));
    const error = await assertRejects(
      () =>
        run.runWith({
          context: { seed: { [CHANNEL_WORKER_CONTEXT]: expected.address() } },
        }, { address: expected.address(), input: [] }),
      ERROR.CHANNEL_BINDING_MISMATCH,
    );
    assertEquals(error.meta?.data, {
      expected: expected.address(),
      actual: actual.address(),
    });
  });

  it("retains an initialization failure without retrying it", async () => {
    const channel = account();
    const expected = new Error("loader failed");
    let initialized = 0;
    const run = step(createChannelWorkerTask(() => {
      initialized++;
      throw expected;
    }));
    for (let attempt = 0; attempt < 2; attempt++) {
      assertStrictEquals(
        await assertRejects(() =>
          run.runWith({
            context: { seed: { [CHANNEL_WORKER_CONTEXT]: channel.address() } },
          }, { address: channel.address(), input: [] })
        ),
        expected,
      );
    }
    assertEquals(initialized, 1);
  });

  it("validates the initializer's executable and preserves native step context", async () => {
    const channel = account();
    const options = {
      context: {
        seed: { [CHANNEL_WORKER_CONTEXT]: channel.address(), value: 10 },
      },
    };
    const invalid = step(
      createChannelWorkerTask(() => ({ channel, run: 1 as never })),
    );
    await assertRejects(
      () => invalid.runWith(options, { address: channel.address(), input: [] }),
      ERROR.INVALID_WORKER_CONFIGURATION,
    );
    const native = step(function (value: number) {
      return value + Number(this.context().state.get("value"));
    });
    const run = step(createChannelWorkerTask(() => ({ channel, run: native })));
    assertEquals(
      await run.runWith(options, { address: channel.address(), input: [2] }),
      12,
    );
  });
});
