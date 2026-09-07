import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { pipe, plugin, step } from "convee";
import {
  type BuildTransactionInput,
  CLASSIC_TRANSACTION_PIPELINE_ID,
  type ClassicTransactionInput,
  INVOKE_CONTRACT_PIPELINE_ID,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  steps,
} from "@colibri/core";
import { Operation, type Transaction } from "stellar-sdk";
import { createChannelAccountsPlugin } from "@/plugin/index.ts";

// Use the real runtime, channel pool and Colibri transaction builder. Supplying
// a sequence explicitly makes these lifecycle checks independent of an RPC.
const createChannelRun = (
  id:
    | typeof CLASSIC_TRANSACTION_PIPELINE_ID
    | typeof INVOKE_CONTRACT_PIPELINE_ID,
) => {
  const actor = LocalSigner.generateRandom();
  const channel = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
  const channels = createChannelAccountsPlugin({ channels: [channel] });
  const input: ClassicTransactionInput = {
    operations: [
      Operation.setOptions({
        source: actor.publicKey(),
        homeDomain: "example.org",
      }),
    ],
    config: {
      source: actor.publicKey(),
      signers: [actor],
      fee: "100",
      timeout: 30,
    },
  };
  const build = pipe([
    step(
      (
        input: ClassicTransactionInput,
      ): BuildTransactionInput & { sequence: string } => ({
        source: input.config.source,
        sequence: "100",
        networkPassphrase: NetworkConfig.TestNet().networkPassphrase,
        baseFee: "100",
        operations: input.operations,
      }),
      { id: "channel-build-input" as const },
    ),
    steps.createBuildTransactionStep(),
  ], { id });

  return { channel, channels, input, build };
};

describe("Channel account finalization", () => {
  for (
    const id of [
      CLASSIC_TRANSACTION_PIPELINE_ID,
      INVOKE_CONTRACT_PIPELINE_ID,
    ] as const
  ) {
    describe(id, () => {
      it("returns a channel after a later input hook rejects", async () => {
        const { build, channels, channel, input } = createChannelRun(id);
        const expected = new Error("input rejected after allocation");
        const rejectInput = plugin({ id: "reject-input" }).onInput(
          (_input: ClassicTransactionInput): ClassicTransactionInput => {
            throw expected;
          },
        );
        build.use(channels);
        build.use(rejectInput);

        assertStrictEquals(await assertRejects(() => build(input)), expected);

        build.remove(rejectInput.id);
        const transaction = await build(input);
        assertEquals(transaction.source, channel.address());
        assertEquals(transaction.fee, "100");
      });

      it("returns a channel after an earlier output hook rejects", async () => {
        const { build, channels, channel, input } = createChannelRun(id);
        const expected = new Error("output rejected before channel cleanup");
        const rejectOutput = plugin({ id: "reject-output" }).onOutput(
          (_transaction: Transaction): Transaction => {
            throw expected;
          },
        );
        build.use(rejectOutput);
        build.use(channels);

        assertStrictEquals(await assertRejects(() => build(input)), expected);

        build.remove(rejectOutput.id);
        assertEquals((await build(input)).source, channel.address());
      });

      it("returns a channel even when an error handler rejects", async () => {
        const { build, channels, channel, input } = createChannelRun(id);
        const expected = new Error("error handler rejected");
        const rejectError = plugin({ id: "reject-error" }).onError(() => {
          throw expected;
        });
        build.use(rejectError);
        build.use(channels);

        // The actual Colibri builder rejects an empty operation list.
        assertStrictEquals(
          await assertRejects(() => build({ ...input, operations: [] })),
          expected,
        );

        build.remove(rejectError.id);
        assertEquals((await build(input)).source, channel.address());
      });

      it("does not replace an early input error when no channel was allocated", async () => {
        const { build, channels, channel, input } = createChannelRun(id);
        const expected = new Error("input rejected before allocation");
        const rejectInput = plugin({ id: "reject-early-input" }).onInput(
          (_input: ClassicTransactionInput): ClassicTransactionInput => {
            throw expected;
          },
        );
        build.use(rejectInput);
        build.use(channels);

        assertStrictEquals(await assertRejects(() => build(input)), expected);

        build.remove(rejectInput.id);
        assertEquals((await build(input)).source, channel.address());
      });

      it("returns a channel if reading the caller config fails during injection", async () => {
        const { build, channels, channel, input } = createChannelRun(id);
        const expected = new Error("caller config unavailable");
        build.use(channels);

        assertStrictEquals(
          await assertRejects(() =>
            build({
              operations: input.operations,
              get config(): never {
                throw expected;
              },
            })
          ),
          expected,
        );

        assertEquals((await build(input)).source, channel.address());
      });

      it("keeps the channel allocated until output hooks finish", async () => {
        const { build, channels, channel, input } = createChannelRun(id);
        const outputEntered = Promise.withResolvers<void>();
        const finishOutput = Promise.withResolvers<void>();
        let completedBuilds = 0;
        const holdOutput = plugin({ id: "hold-output" }).onOutput(
          async (transaction: Transaction) => {
            completedBuilds++;
            outputEntered.resolve();
            await finishOutput.promise;
            return transaction;
          },
        );
        build.use(channels);
        build.use(holdOutput);

        const firstRun = build(input);
        await outputEntered.promise;
        const secondRun = build(input);

        // Yield an event-loop turn so the second run reaches allocation.
        // The first output hook still holds the only available channel.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        assertEquals(completedBuilds, 1);

        finishOutput.resolve();
        const [first, second] = await Promise.all([firstRun, secondRun]);
        assertEquals(first.source, channel.address());
        assertEquals(second.source, channel.address());
        assertEquals(completedBuilds, 2);
      });

      it("unblocks a queued run when an allocated run fails in its input hook", async () => {
        const { build, channels, channel, input } = createChannelRun(id);
        const allocated = Promise.withResolvers<void>();
        const failFirst = Promise.withResolvers<void>();
        const expected = new Error("first allocated run failed");
        let allocatedRuns = 0;
        const failFirstInput = plugin({ id: "fail-first-input" }).onInput(
          async (value: ClassicTransactionInput) => {
            allocatedRuns++;
            if (allocatedRuns === 1) {
              allocated.resolve();
              await failFirst.promise;
              throw expected;
            }
            return value;
          },
        );
        build.use(channels);
        build.use(failFirstInput);

        const failure = assertRejects(() => build(input));
        await allocated.promise;
        const waitingRun = build(input);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        assertEquals(allocatedRuns, 1);

        failFirst.resolve();
        assertStrictEquals(await failure, expected);
        assertEquals((await waitingRun).source, channel.address());
        assertEquals(allocatedRuns, 2);
      });
    });
  }
});
