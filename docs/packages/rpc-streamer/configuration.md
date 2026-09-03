# Streamer configuration

Factories and `new RPCStreamer<T>()` accept `rpcUrl`, optional `archiveRpcUrl`,
and `options`. `allowHttp` defaults to `false`; `archiveAllowHttp` defaults to
`allowHttp`. Enable HTTP only for an intentionally local/trusted service.

The event factory additionally accepts `filters: EventFilter[]`. Custom
streamers accept `ingestLive` and `ingestArchive`; see
[the custom guide](custom.md).

| `options` property       | Default | Actual use                                             |
| ------------------------ | ------- | ------------------------------------------------------ |
| `limit`                  | `10`    | Event page size; the ledger variant fetches one ledger |
| `waitLedgerIntervalMs`   | `5000`  | Delay when live ingestion says to wait                 |
| `pagingIntervalMs`       | `100`   | Delay between event pages                              |
| `archivalIntervalMs`     | `500`   | Delay between archive reads                            |
| `skipLedgerWaitIfBehind` | `false` | Automatic mode can skip its catch-up wait              |

`pagingIntervalMs` must not exceed `waitLedgerIntervalMs`. These are pacing
inputs, not a rate-limit retry policy. Custom ingestors implement their own
paging and archive pacing; the generic engine does not paginate for them.

## Per-run options

| Property             | Purpose                                                   |
| -------------------- | --------------------------------------------------------- |
| `startLedger`        | Latest by default in live/auto; required in archive       |
| `stopLedger`         | Inclusive; required in archive                            |
| `onCheckpoint`       | Periodic progress notification                            |
| `checkpointInterval` | Ledger-number modulus for notifications; default `100`    |
| `onError`            | Synchronous decision callback; `false` stops and rethrows |

Read [progress and recovery](recovery.md) before persisting or skipping data.

## Runtime access

`rpc`, `archiveRpc`, and `isRunning` expose configured clients and lifecycle
state. `setArchiveRpc(url, allowHttp?)` configures an archive client later;
guarded setters reject assigning clients twice. Prefer constructor configuration
and a new streamer when changing providers.

See the full types:
[RPCStreamerConfig](https://jsr.io/@colibri/rpc-streamer/doc/~/RPCStreamerConfig),
[StreamerOptions](https://jsr.io/@colibri/rpc-streamer/doc/~/StreamerOptions),
and
[start options](https://jsr.io/@colibri/rpc-streamer/doc/~/AutoStartOptions).
