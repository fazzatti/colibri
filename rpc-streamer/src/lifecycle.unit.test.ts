import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  archiveErrorAllowsSkipping,
  completeArchiveLedger,
  waitForStream,
} from "@/lifecycle.ts";
import { RPCStreamerError, RPCStreamerErrorCode } from "@/errors.ts";
import {
  createEventStreamer,
  createLedgerStreamer,
} from "@colibri/rpc-streamer";

describe("cooperative stream lifecycle", () => {
  it("only skips archive errors when the application deliberately permits it", () => {
    const context = { isRunning: () => true };
    assertEquals(
      archiveErrorAllowsSkipping(new Error("application failure"), 1, context),
      false,
    );
    for (const response of [true, false, undefined]) {
      assertEquals(
        archiveErrorAllowsSkipping(new Error("application failure"), 1, {
          ...context,
          onError: () => response,
        }),
        response !== false,
      );
    }
    const persistence = new RPCStreamerError(
      RPCStreamerErrorCode.CHECKPOINT_FAILED,
      "failure",
    );
    assertEquals(
      archiveErrorAllowsSkipping(persistence, 1, {
        ...context,
        onError: () => {
          throw new Error("Must not override failed persistence");
        },
      }),
      false,
    );
    assertEquals(
      archiveErrorAllowsSkipping(
        new RPCStreamerError(RPCStreamerErrorCode.PARSE_FAILED, "failure"),
        1,
        { ...context, onError: () => true },
      ),
      true,
    );
  });
  it("supports already-aborted signals and aborts pending waits", async () => {
    await waitForStream(60_000, AbortSignal.abort());
    const controller = new AbortController();
    const pending = waitForStream(60_000, controller.signal);
    controller.abort();
    await pending;
    await waitForStream(0);
  });
  it("awaits checkpoint completion in standalone archive ingestors", async () => {
    let completed = 0;
    const context = {
      isRunning: () => true,
      checkpointInterval: 2,
      onCheckpoint: async () => {
        await waitForStream(1);
        completed++;
      },
    };
    await completeArchiveLedger(context, 1);
    assertEquals(completed, 0);
    await completeArchiveLedger(context, 2);
    assertEquals(completed, 1);
    await completeArchiveLedger({ isRunning: () => true }, 2);
    await completeArchiveLedger(
      { ...context, checkpointInterval: undefined },
      100,
    );
    assertEquals(completed, 2);
  });
  it("does not contact RPC for a pre-aborted run and remains restartable", async () => {
    for (const create of [createEventStreamer, createLedgerStreamer]) {
      const streamer = create({
        rpcUrl: "https://not-contacted.invalid",
        archiveRpcUrl: "https://not-contacted.invalid",
      });
      assertEquals(streamer.nextLedger, undefined);
      const options = {
        signal: AbortSignal.abort(),
        startLedger: 123,
        stopLedger: 124,
      };
      await streamer.startLive(() => {}, options);
      await streamer.start(() => {}, options);
      await streamer.startArchive(() => {}, options);
      assertEquals(streamer.isRunning, false);
      assertEquals(streamer.nextLedger, 123);
    }
  });
});
