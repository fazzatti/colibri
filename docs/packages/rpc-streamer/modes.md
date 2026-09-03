# Live, archive, and automatic modes

All modes use inclusive `startLedger` and `stopLedger` boundaries. A missing
stop means keep streaming in live/automatic mode. Archive-only mode requires
both.

| Method                           | Data source                    | When to use it                         |
| -------------------------------- | ------------------------------ | -------------------------------------- |
| `startLive(handler, options?)`   | Live RPC only                  | Recent data within the available range |
| `startArchive(handler, options)` | Archive RPC only               | A bounded historical backfill          |
| `start(handler, options?)`       | Archive when needed, then live | Catch up and continue                  |

## Availability is discovered

Live and automatic mode read RPC health. They use `oldestLedger + 2` as the
oldest safe live ledger and default the start to `latestLedger`. Do not
hard-code a retention duration or copy old ledger numbers. A requested start
ahead of the latest ledger is rejected; it is not a scheduling mechanism.

Automatic mode refreshes health as it advances. If the current ledger is too
old, it reads through the archive up to the live boundary (or your stop), then
uses the live ingestor. Both an archive RPC and archive ingestor must exist.
Built-in factories supply the ingestors; you supply a suitable endpoint.

## Historical backfill

This fragment expects endpoints, bounds, and `saveLedger` from your application:

```ts
const streamer = RPCStreamer.ledger({ rpcUrl, archiveRpcUrl });
await streamer.startArchive(saveLedger, { startLedger, stopLedger });
```

An archive RPC is a Stellar RPC service exposing the necessary ledger data, not
a raw history archive bucket. Both endpoints must represent the same network.
Colibri does not establish cross-provider identity for you.

## Failure boundaries

- Live-only mode never falls back to the archive.
- Automatic mode cannot recover an old start without an archive endpoint.
- Archive-only mode rejects a reversed range and missing archive configuration.
- Starting an already running instance fails. Await its completion first.

See [configuration](configuration.md), [recovery](recovery.md), and
[complete error codes](../../reference/errors/rpc-streamer.md).
