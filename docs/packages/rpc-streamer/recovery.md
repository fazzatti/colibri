# Progress, errors, and shutdown

Colibri awaits data callbacks, but does not offer exactly-once processing or a
transactional checkpoint store. Treat delivery as replayable and make writes
idempotent.

## Stop and finish

```ts
const running = streamer.start(handleData);
// Later, for example from your application's shutdown handler:
streamer.stop();
await running;
```

`stop()` changes the running flag and interrupts pacing timers. An optional
`signal: controller.signal` in any start method has the same effect. Neither
mechanism abandons an ongoing SDK request or callback; the promise settles after
that work finishes. Await it before starting again, even when `isRunning` is
already false. A pre-aborted signal performs no RPC requests.

For built-in event streams, calling `stop()` from a data callback prevents
delivery of the remaining events in that page. An interrupted ledger is not
reported as a completed checkpoint; replay it when resuming.

For built-in ledger streams, a fulfilled callback completes the entire ledger,
even if it calls `stop()` or aborts the signal. Colibri still awaits its
interval-based checkpoint and advances `nextLedger`. If the callback or
checkpoint rejects, successful completion is not acknowledged. Stopping before
the fetched ledger reaches its callback also leaves that ledger for replay.

## Durable progress

Built-in streamers await `onCheckpoint` before advancing beyond the completed
ledger. A rejected checkpoint stops with `RPC_023` (`CHECKPOINT_FAILED`) and
preserves the cause; `onError` cannot turn that persistence failure into a skip.
No final checkpoint is forced at shutdown. A checkpoint acknowledges your
callback's completion, not a distributed transaction or exactly-once guarantee.

`nextLedger` is the in-memory continuation position of the last run. After a
clean bounded run it is `stopLedger + 1`; after interruption it is the partial
ledger to replay, or the next ledger if the whole-ledger callback completed. It
is undefined before a position has been established. Reuse it with the same
network and filters. It is **not durable storage** and may be ahead of the last
interval-based persisted checkpoint.

For ledger processing, await data storage and progress storage together inside
the data handler, preferably in one database transaction. Resume at the last
fully committed ledger plus one. For events, deduplicate by event ID and
conservatively replay the last incomplete ledger: committing one event does not
mean every event in that ledger was committed.

The interval is `ledger % interval === 0`, not an item count since startup. Use
a positive nonzero integer.

```ts
const controller = new AbortController();
const running = streamer.start(saveEvent, {
  signal: controller.signal,
  checkpointInterval: 1,
  onCheckpoint: async (completedLedger) => {
    await database.saveProgress(completedLedger);
  },
});
// In your shutdown handler:
controller.abort();
await running;
console.log("Next ledger for an in-process restart:", streamer.nextLedger);
```

## Continuing after errors skips work

Without `onError`, ingestion errors reject the run. If the callback exists, only
explicit `false` stops and rethrows. `true` **or no return value** tells the
current loop to advance past the failed ledger. This is not a retry. That
deliberate skip can advance `nextLedger`; it does not certify successful
consumption of the skipped data. Checkpoint failures are the exception above.

```ts
await streamer.start(handleData, {
  onError: (error, ledger) => {
    console.error(`Stopped at ledger ${ledger}`, error);
    return false; // Decide how to resume outside this run.
  },
});
```

For reliable indexing, stop, inspect, and restart from a known durable boundary.
Do not automatically skip a failed write.

## Error shapes

Framework validation uses `RPCStreamerError` with `code`, `details`, `cause`,
and `toJSON()`. It extends JavaScript `Error`, **not** `ColibriError`. RPC
failures, parsing failures, and callback exceptions can also propagate
unwrapped; keep an unknown-error branch.

See [every declared RPC code](../../reference/errors/rpc-streamer.md). Some are
reserved declarations, not active retry or failure-budget features.
