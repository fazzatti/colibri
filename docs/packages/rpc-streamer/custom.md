# Create a custom streamer

Use `RPCStreamer<T>` for application-specific results. The engine owns
lifecycle, live-range checks, and routing. Your ingestor owns fetching,
pagination, filtering, callback delivery, and cursor progress.

This complete live-only example extracts a ledger summary. Install packages from
the [overview](../rpc-streamer.md) and run `deno run --allow-net summaries.ts`.

<!-- deno-check -->

```ts
import { Ledger, NetworkConfig } from "@colibri/core";
import { type LiveIngestFunc, RPCStreamer } from "@colibri/rpc-streamer";

type Summary = { sequence: number; hash: string };
const ingestLive: LiveIngestFunc<Summary> = async (
  rpc,
  sequence,
  onData,
  stopLedger,
  context,
) => {
  const response = await rpc.getLedgers({
    startLedger: sequence,
    pagination: { limit: 1 },
  });
  if (context && !context.isRunning()) {
    return { nextLedger: sequence, shouldWait: false, hitStopLedger: false };
  }
  const entry = response.ledgers[0];
  if (!entry) {
    return { nextLedger: sequence, shouldWait: true, hitStopLedger: false };
  }
  if (stopLedger !== undefined && entry.sequence > stopLedger) {
    return {
      nextLedger: entry.sequence,
      shouldWait: false,
      hitStopLedger: true,
    };
  }
  const ledger = Ledger.fromEntry(entry);
  await onData({ sequence: ledger.sequence, hash: ledger.hash });
  return {
    nextLedger: ledger.sequence + 1,
    shouldWait: ledger.sequence >= response.latestLedger,
    hitStopLedger: false,
  };
};

const streamer = new RPCStreamer<Summary>({
  rpcUrl: NetworkConfig.TestNet().rpcUrl,
  ingestLive,
});
const { latestLedger } = await streamer.rpc.getHealth();
await streamer.startLive(console.log, {
  startLedger: latestLedger,
  stopLedger: latestLedger,
});
```

`getLedgers` is the SDK's public method. `Ledger.fromEntry()` accepts its native
decoded entries as well as raw encoded entries. Prefer the built-in factory when
no projection is needed.

## Ingestor contracts

- `nextLedger` is the next ledger to request, not the last processed ledger.
  Return the same ledger when it is not yet available.
- `shouldWait` requests a delay before another live request.
- `hitStopLedger` signals an unconsumed response beyond the requested bound. For
  a fully consumed final ledger return `false` and its next ledger, allowing the
  engine to checkpoint before stopping. Never deliver records beyond it.
- Await `onData`. Finish pagination before advancing past a partially consumed
  ledger.

An `ArchiveIngestFunc<T>` receives the archive client, inclusive start/stop,
handler, and `ArchiveIngestContext`. Check `context.isRunning()` between
requests, apply your pacing and error policy, and return the next ledger after
the processed range. Await `context.onLedgerComplete?.(ledger)` only after every
callback for that ledger completes. This lets the engine await persistence and
record continuation together. For standalone ingestors using an older context,
await `onCheckpoint` at `ledger % (checkpointInterval ?? 100) === 0` instead.
Use `context.signal` to interrupt custom pacing waits and check `isRunning()`
between callbacks. Cancellation of in-flight SDK requests is not implied.
Live-only configuration is supported; attempting archive mode without its
ingestor fails with `MISSING_ARCHIVE_INGESTOR`.
