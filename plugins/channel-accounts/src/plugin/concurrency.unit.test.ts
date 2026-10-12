import {
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { ConcurrencyError, pipe, plugin, step } from "convee";
import {
  CLASSIC_TRANSACTION_PIPELINE_ID,
  type ClassicTransactionInput,
  INVOKE_CONTRACT_PIPELINE_ID,
  LocalSigner,
  NativeAccount,
} from "@colibri/core";
import { createChannelAccountsPlugin } from "@/plugin/index.ts";

const { describe, it } = recordColibriTests(import.meta.url);
const channel = () =>
  NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
const originalSource = LocalSigner.generateRandom().publicKey();
const input = (): ClassicTransactionInput => ({
  operations: [],
  config: { source: originalSource, signers: [], fee: "100", timeout: 30 },
});
const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("Channel plugin concurrency", () => {
  it("shares one configured limit across classic and invoke pipelines without cloning live values", async () => {
    const channels = [channel(), channel(), channel()];
    const admission = createChannelAccountsPlugin(
      Object.assign({ channels }, { concurrency: 1 }),
    );
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const original = { live: () => true };
    const actor = LocalSigner.generateRandom();
    const payload = input();
    payload.config.signers = [actor];
    let active = 0;
    let peak = 0;
    const process = async (value: ClassicTransactionInput) => {
      assertStrictEquals(value.operations, payload.operations);
      assertStrictEquals(value.config.signers[0], actor);
      const allocated = channels.find((account) =>
        account.address() === value.config.source
      )!;
      assertStrictEquals(value.config.signers[1], allocated.signer());
      peak = Math.max(peak, ++active);
      entered.resolve();
      await release.promise;
      active--;
      return original;
    };
    const classic = pipe([step(process)], {
      id: CLASSIC_TRANSACTION_PIPELINE_ID,
    });
    const invoke = pipe([step(process)], { id: INVOKE_CONTRACT_PIPELINE_ID });
    classic.use(admission);
    invoke.use(admission);
    const runs = [classic(payload), invoke(payload), classic(payload)];
    try {
      await entered.promise;
      await turn();
      assertEquals(peak, 1);
    } finally {
      release.resolve();
      const results = await Promise.all(runs);
      for (const result of results) assertStrictEquals(result, original);
    }
    assertEquals(payload.config.source, originalSource);
    assertEquals(payload.config.signers, [actor]);
    assertEquals(peak, 1);
  });

  it("rejects excess pending work before input injection, exposes the original typed error and restores capacity", async () => {
    const channels = [channel(), channel()];
    const admission = createChannelAccountsPlugin(
      Object.assign({ channels }, { concurrency: 1, maxPending: 2 }),
    );
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const seen: number[] = [];
    const run = pipe([
      step(async (value: ClassicTransactionInput & { id: number }) => {
        seen.push(value.id);
        started.resolve();
        await release.promise;
        return value.id;
      }),
    ], { id: CLASSIC_TRANSACTION_PIPELINE_ID });
    let intercepted: unknown;
    run.use(admission);
    const observeCapacity = plugin({ id: "observe-capacity" }).onError(
      (error: Error): never => {
        intercepted = error;
        throw error;
      },
    );
    run.use(observeCapacity);
    const first = run({ ...input(), id: 1 });
    await started.promise;
    const second = run({ ...input(), id: 2 });
    await turn();
    let thirdError: unknown;
    const third = run({ ...input(), id: 3 }).catch((error) => {
      thirdError = error;
    });
    try {
      await turn();
      assertEquals((thirdError as ConcurrencyError)?.code, "CNC_CAPACITY");
      assertEquals(intercepted, undefined);
      assertEquals(thirdError instanceof ConcurrencyError, true);
      assertEquals(seen, [1]);
    } finally {
      release.resolve();
      await Promise.all([first, second, third]);
    }
    assertEquals(await run({ ...input(), id: 4 }), 4);
    assertEquals(seen, [1, 2, 4]);
  });

  it("waits for late registration and counts requests waiting for a channel toward admission", async () => {
    const admission = createChannelAccountsPlugin(
      Object.assign({ channels: [] }, { concurrency: 2, maxPending: 2 }),
    );
    const run = pipe([
      step((value: ClassicTransactionInput) => value.config.source),
    ], { id: CLASSIC_TRANSACTION_PIPELINE_ID });
    run.use(admission);
    const pending = [run(input()), run(input())];
    await turn();
    let rejected: unknown;
    const overflow = run(input()).catch((error) => {
      rejected = error;
    });
    try {
      await turn();
      assertEquals((rejected as ConcurrencyError)?.code, "CNC_CAPACITY");
      assertEquals(admission.getChannels(), []);
    } finally {
      const account = channel();
      admission.registerChannels([account, account]);
      assertEquals(await Promise.all(pending), [
        account.address(),
        account.address(),
      ]);
      await overflow;
      assertEquals(admission.getChannels(), [account]);
    }
  });

  it("uses channels registered during active work while preserving the explicit cap", async () => {
    const firstChannel = channel();
    const added = channel();
    const admission = createChannelAccountsPlugin(
      Object.assign({ channels: [firstChannel] }, { concurrency: 2 }),
    );
    const release = Promise.withResolvers<void>();
    const seen: string[] = [];
    const run = pipe([step(async (value: ClassicTransactionInput) => {
      seen.push(value.config.source);
      await release.promise;
      return value.config.source;
    })], { id: CLASSIC_TRANSACTION_PIPELINE_ID });
    run.use(admission);
    const pending = [run(input()), run(input()), run(input())];
    try {
      await turn();
      assertEquals(seen, [firstChannel.address()]);
      admission.registerChannels([firstChannel, added, added]);
      await turn();
      assertEquals(seen, [firstChannel.address(), added.address()]);
      assertEquals(admission.getChannels().length, 2);
    } finally {
      release.resolve();
      await Promise.all(pending);
    }
    assertEquals(seen.length, 3);
  });

  it("holds its permit through output hooks, then releases after a hook failure", async () => {
    const admission = createChannelAccountsPlugin(
      Object.assign({ channels: [channel(), channel()] }, { concurrency: 1 }),
    );
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const failure = new Error("output failed");
    let executions = 0;
    const run = pipe(
      [step((_value: ClassicTransactionInput) => ++executions)],
      { id: CLASSIC_TRANSACTION_PIPELINE_ID },
    );
    run.use(admission);
    run.use(
      plugin({ id: "failing-output" }).onOutput(async (value: number) => {
        if (value === 1) {
          entered.resolve();
          await release.promise;
          throw failure;
        }
        return value;
      }),
    );
    const first = assertRejects(() => run(input()));
    await entered.promise;
    const second = run(input());
    try {
      await turn();
      assertEquals(executions, 1);
    } finally {
      release.resolve();
      assertStrictEquals(await first, failure);
      assertEquals(await second, 2);
    }
  });

  it("keeps pending work unlimited by default, deduplicates channels and serves waiters in order", async () => {
    const account = channel();
    const admission = createChannelAccountsPlugin({
      channels: [account, account],
    });
    const seen: number[] = [];
    const run = pipe([
      step((value: ClassicTransactionInput & { id: number }) => {
        seen.push(value.id);
        return value.id;
      }),
    ], { id: CLASSIC_TRANSACTION_PIPELINE_ID });
    run.use(admission);
    const ids = Array.from({ length: 1030 }, (_, id) => id);
    assertEquals(
      await Promise.all(ids.map((id) => run({ ...input(), id }))),
      ids,
    );
    assertEquals(seen, ids);
    assertEquals(admission.getChannels(), [account]);
  });

  for (const option of ["concurrency", "maxPending"]) {
    for (
      const value of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]
    ) {
      it(`rejects invalid ${option}=${value} during construction`, () => {
        const error = assertThrows(
          () => createChannelAccountsPlugin({ channels: [], [option]: value }),
          ConcurrencyError,
        );
        assertEquals(error.code, "CNC_CONFIG");
      });
    }
  }
});
