import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  type ClassicTransactionInput,
  LocalSigner,
  NativeAccount,
} from "@colibri/core";
import { ConcurrencyError, plugin, step } from "convee";
import { createChannelAccountsConcurrent } from "@/concurrency/index.ts";
import * as ERROR from "@/shared/error.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const account = () =>
  NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
const actor = account();
const input = (): ClassicTransactionInput => ({
  operations: [],
  config: {
    source: actor.address(),
    signers: [actor.signer()],
    fee: "100",
    timeout: 30,
  },
});
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Local channel concurrency", () => {
  it("rejects malformed JavaScript configuration with a typed setup error", () => {
    assertThrows(
      () => createChannelAccountsConcurrent(null as never),
      ERROR.INVALID_CHANNEL_CONFIGURATION,
    );
    assertThrows(
      () =>
        createChannelAccountsConcurrent(
          { channels: undefined, run() {} } as never,
        ),
      ERROR.INVALID_CHANNEL_CONFIGURATION,
    );
  });

  it("captures the configured callable while retaining application data references", async () => {
    const args = {
      channels: [account()],
      run: (_input: ClassicTransactionInput) => "original",
    };
    const execute = createChannelAccountsConcurrent(args);
    args.run = () => "changed";
    assertEquals(await execute(input()), "original");
  });
  it("requires channels and a callable without changing the existing plugin's dynamic model", () => {
    assertThrows(
      () =>
        createChannelAccountsConcurrent({
          channels: [],
          run: (_input: ClassicTransactionInput) => 1,
        }),
      ERROR.INVALID_CHANNEL_CONFIGURATION,
    );
    assertThrows(
      () =>
        createChannelAccountsConcurrent({
          channels: [account()],
          run: 1 as never,
        }),
      ERROR.INVALID_CHANNEL_CONFIGURATION,
    );
  });

  it("shares capacity across callers, retains references and never leases the same account twice", async () => {
    const channels = [account(), account()];
    const original = input();
    const gates = Array.from(
      { length: 3 },
      () => Promise.withResolvers<void>(),
    );
    const started: number[] = [];
    const active = new Set<string>();
    const output = { liveFunction: () => "same object" };
    const run = createChannelAccountsConcurrent({
      channels,
      run: async (value: ClassicTransactionInput & { index: number }) => {
        const { source, signers } = value.config;
        assertEquals(active.has(source), false);
        active.add(source);
        assertStrictEquals(signers[0], original.config.signers[0]);
        assertStrictEquals(
          signers[1],
          channels.find((channel) => channel.address() === source)!.signer(),
        );
        assertStrictEquals(value.operations, original.operations);
        started.push(value.index);
        await gates[value.index].promise;
        active.delete(source);
        return output;
      },
    });
    const results = [0, 1, 2].map((index) => run({ ...original, index }));
    await turn();
    assertEquals(started, [0, 1]);
    assertEquals(active.size, 2);
    gates[1].resolve();
    await turn();
    assertEquals(started, [0, 1, 2]);
    gates[0].resolve();
    gates[2].resolve();
    for (const result of await Promise.all(results)) {
      assertStrictEquals(result, output);
    }
    assertEquals(original.config.source, actor.address());
    assertEquals(original.config.signers, [actor.signer()]);
  });

  it("deduplicates account addresses and preserves original errors without replay", async () => {
    const channel = account();
    const expected = new Error("pipeline failure");
    let executions = 0;
    const run = createChannelAccountsConcurrent({
      channels: [channel, channel],
      run: (_value: ClassicTransactionInput) => {
        executions++;
        throw expected;
      },
    });
    assertStrictEquals(await assertRejects(() => run(input())), expected);
    assertEquals(executions, 1);
    assertStrictEquals(await assertRejects(() => run(input())), expected);
    assertEquals(executions, 2);
  });

  it("releases the lease if reading input config fails during injection", async () => {
    const expected = new Error("config unavailable");
    const run = createChannelAccountsConcurrent({
      channels: [account()],
      run: (value: ClassicTransactionInput) => value.config.source,
    });
    assertStrictEquals(
      await assertRejects(() =>
        run({
          operations: [],
          get config(): never {
            throw expected;
          },
        })
      ),
      expected,
    );
    assertEquals(typeof await run(input()), "string");
  });

  it("keeps native context and the lease through pipeline finalization", async () => {
    const entered = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    let executions = 0;
    const pipeline = step(function (_value: ClassicTransactionInput) {
      executions++;
      return this.context().state.get("marker");
    });
    pipeline.use(
      plugin({ id: "hold-finalization" }).onFinally(async () => {
        entered.resolve();
        await finish.promise;
      }),
    );
    const run = createChannelAccountsConcurrent({
      channels: [account()],
      run: pipeline,
    });
    const marker = { live: () => "reference" };
    const first = run.runWith({ context: { seed: { marker } } }, input());
    await entered.promise;
    const second = run.runWith({ context: { seed: { marker } } }, input());
    await turn();
    assertEquals(executions, 1);
    finish.resolve();
    assertStrictEquals(await first, marker);
    assertStrictEquals(await second, marker);
  });

  it("applies native caller plugins around the request and keeps admission bounded", async () => {
    const entered = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    let outputs = 0;
    const run = createChannelAccountsConcurrent({
      channels: [account()],
      maxPending: 1,
      run: async (_value: ClassicTransactionInput) => {
        entered.resolve();
        await finish.promise;
        return 1;
      },
      plugins: [
        plugin({ id: "caller-hooks" }).onOutput((value: number) => {
          outputs++;
          return value + 1;
        }),
      ],
    });
    const first = run(input());
    await entered.promise;
    const error = await assertRejects(() => run(input()), ConcurrencyError);
    assertEquals(error.code, "CNC_CAPACITY");
    finish.resolve();
    assertEquals(await first, 2);
    assertEquals(outputs, 1);
  });

  it("cancels queued work without borrowing a channel or interrupting active cleanup", async () => {
    const entered = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    let executions = 0;
    const run = createChannelAccountsConcurrent({
      channels: [account()],
      run: async (_value: ClassicTransactionInput) => {
        executions++;
        entered.resolve();
        await finish.promise;
        return executions;
      },
    });
    const activeController = new AbortController();
    let settled = false;
    const active = assertRejects(
      () => run.runWith({ signal: activeController.signal }, input()),
      ConcurrencyError,
    ).then((error) => {
      settled = true;
      return error;
    });
    await entered.promise;
    const queuedController = new AbortController();
    const queued = assertRejects(
      () => run.runWith({ signal: queuedController.signal }, input()),
      ConcurrencyError,
    );
    queuedController.abort();
    assertEquals((await queued).code, "CNC_ABORTED");
    activeController.abort();
    await turn();
    assertEquals(settled, false);
    assertEquals(executions, 1);
    finish.resolve();
    assertEquals((await active).code, "CNC_ABORTED");
    assertEquals(await run(input()), 2);
  });
});
