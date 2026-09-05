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

`stop()` changes the running flag. It does not abort an ongoing request,
callback, or timer. The promise settles after the active work and loop have
finished.

For built-in live event streams, calling `stop()` from a data callback prevents
delivery of the remaining events in that page. An interrupted ledger is not
reported as a completed checkpoint; replay it when resuming.

## Durable progress

`onCheckpoint` is a notification, not an acknowledged commit barrier. The
current implementation does not await a promise returned by that callback. It
also does not guarantee a final checkpoint at shutdown. Do not use an
asynchronous checkpoint callback as the sole proof that data has been persisted.

For ledger processing, await data storage and progress storage together inside
the data handler, preferably in one database transaction. Resume at the last
fully committed ledger plus one. For events, deduplicate by event ID and
conservatively replay the last incomplete ledger: committing one event does not
mean every event in that ledger was committed.

The interval is `ledger % interval === 0`, not an item count since startup. Use
a positive nonzero integer.

## Continuing after errors skips work

Without `onError`, ingestion errors reject the run. If the callback exists, only
explicit `false` stops and rethrows. `true` **or no return value** tells the
current loop to advance past the failed ledger. This is not a retry.

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
