# @colibri/rpc-streamer

[Developer guides](https://fifo-docs.gitbook.io/colibri/packages/rpc-streamer) ·
[API reference](https://jsr.io/@colibri/rpc-streamer/doc)

Stream Stellar events and ledgers through Stellar RPC. Built-in factories handle
ledger boundaries, event pagination, archive-to-live transitions, and awaited
callbacks. `RPCStreamer<T>` also accepts custom ingestors without replacing the
native Stellar SDK client.

```sh
deno add jsr:@colibri/rpc-streamer jsr:@colibri/core
```

## Stream events or ledgers

```ts
import { EventFilter, EventType, NetworkConfig } from "@colibri/core";
import { RPCStreamer } from "@colibri/rpc-streamer";

const streamer = RPCStreamer.event({
  networkConfig: NetworkConfig.TestNet(),
  filters: [new EventFilter({ type: EventType.Contract })],
});

// Without startLedger, begin at the latest ledger.
// Without stopLedger, continue until stopped.
await streamer.start(async (event) => {
  console.log(event.id, event.ledger, event.contractId);
});
```

Use `RPCStreamer.ledger(config)` to receive Core `Ledger` objects instead. Both
factories are also exported as `createEventStreamer` and `createLedgerStreamer`.

## Connections and modes

Choose exactly one live connection, in both TypeScript and runtime inputs:

- `{ rpcUrl, allowHttp? }` for individual settings;
- `{ networkConfig }` for a Colibri `NetworkConfig` containing an RPC URL;
- `{ rpc }` to reuse a caller-owned Stellar SDK `Server` unchanged.

Archive access is separate: optionally provide `archiveRpc`, or `archiveRpcUrl`
and `archiveAllowHttp`. Do not combine a native client with URL options for the
same connection. The archive is not inferred from the live network
configuration. Both endpoints must serve the same network. HTTP defaults to
disabled; the archive URL inherits the live URL/network's setting unless
explicitly overridden.

| Method                           | Source and bounds                             |
| -------------------------------- | --------------------------------------------- |
| `start(handler, options?)`       | Uses archive for older ledgers, then live RPC |
| `startLive(handler, options?)`   | Live RPC only, within its retention window    |
| `startArchive(handler, options)` | Archive RPC only; requires start and stop     |

Bounds are inclusive. An explicitly unavailable future starting ledger is
rejected; an active run at the chain tip waits for new ledgers. Historical reads
require a Stellar RPC exposing ledger data, not a raw history-archive bucket.

## Cancellation and checkpoints

This fragment assumes application-owned `saveEvent`, `database`, and a
configured streamer. Data writes should be idempotent because interrupted
ledgers can replay.

```ts
const controller = new AbortController();
const running = streamer.start(saveEvent, {
  signal: controller.signal,
  checkpointInterval: 1,
  onCheckpoint: async (completedLedger) => {
    await database.saveProgress(completedLedger);
  },
  onError: (error, ledger) => {
    console.error(`Stopped at ledger ${ledger}`, error);
    return false;
  },
});

// In your shutdown handler:
controller.abort(); // Or streamer.stop().
await running;
console.log("Next ledger:", streamer.nextLedger);
```

- Data callbacks and checkpoint callbacks are awaited. Checkpoint rejection
  stops with `RPC_023` (`CHECKPOINT_FAILED`), preserving the cause.
- `stop()`/`AbortSignal` interrupts pacing waits and stops between callbacks.
  In-flight SDK requests and callbacks are allowed to finish. Await the run's
  promise before restarting, even if `isRunning` is already false.
- `nextLedger` is an in-memory continuation position, not a durable checkpoint.
  It points to a partial ledger for replay, or the next ledger after completion.
  Reuse it only with the same network and filters. A new process must load its
  last durable checkpoint instead.
- The checkpoint interval defaults to `100` and means `ledger % interval === 0`.
  No final checkpoint is forced on shutdown. Use a positive nonzero integer.
- `onError` returning `true` or nothing deliberately **skips** the failed
  ledger; it does not retry. Checkpoint failures cannot be skipped this way.
- This is not exactly-once delivery or a transactional storage abstraction.

## Pacing

Configure these under `options` in the constructor:

| Property                 | Default | Applies to                                     |
| ------------------------ | ------- | ---------------------------------------------- |
| `limit`                  | `10`    | Event page size; ledger reads fetch one ledger |
| `waitLedgerIntervalMs`   | `5000`  | Live wait at the tip                           |
| `pagingIntervalMs`       | `100`   | Event pagination                               |
| `archivalIntervalMs`     | `500`   | Archive reads                                  |
| `skipLedgerWaitIfBehind` | `false` | Auto-mode catch-up                             |

`pagingIntervalMs` cannot exceed `waitLedgerIntervalMs`. These are pacing
settings, not automatic retry or failure-budget policies.

## Custom ingestors and native SDK compatibility

`new RPCStreamer<T>({ rpc, ingestLive, ingestArchive })` delegates fetching and
projection to your functions. Either ingestor can be omitted when its mode is
unused. Use native `Server.getLedgers()` responses directly with
`Ledger.fromEntry()`; it also accepts raw encoded entries.

Custom ingestors own pagination, filter handling, and callback delivery. Check
the optional live context or archive context between callbacks. An archive
ingestor should await `context.onLedgerComplete?.(ledger)` only after consuming
the full ledger, and return the next ledger to request. See the
[complete custom ingestor example](https://fifo-docs.gitbook.io/colibri/packages/rpc-streamer/custom).

## Errors and runtime access

Streamer-owned errors use `RPCStreamerError`, a JavaScript `Error` subclass with
`code`, `details`, `cause`, and `toJSON()`. Native RPC, parsing, and
data-callback errors can propagate unchanged; keep an unknown-error branch. See
the
[complete error catalog](https://fifo-docs.gitbook.io/colibri/reference/errors/rpc-streamer).

`rpc`, `archiveRpc`, `isRunning`, and `nextLedger` expose runtime state.
Assigning an already configured RPC property is rejected. The explicit
`setArchiveRpc(url, allowHttp?)` method replaces the archive client; prefer a
new streamer when changing providers between runs.

## License

MIT
