# Streamer configuration

Factories and `new RPCStreamer<T>()` accept exactly one live connection:

- `{ rpcUrl, allowHttp? }` for granular configuration;
- `{ networkConfig }` to reuse a Colibri `NetworkConfig` containing `rpcUrl`;
- `{ rpc }` to reuse a native Stellar SDK `Server` unchanged.

The alternatives are exclusive in TypeScript and at runtime. `allowHttp` belongs
to the URL alternative. A supplied native client already owns its configuration.

<!-- deno-check -->

```ts
import { NetworkConfig } from "@colibri/core";
import { createLedgerStreamer } from "@colibri/rpc-streamer";
import { Server } from "npm:@stellar/stellar-sdk@^17.0.1/rpc";

const networkConfig = NetworkConfig.TestNet();
const fromNetwork = createLedgerStreamer({ networkConfig });
const rpc = new Server(networkConfig.rpcUrl);
const fromClient = createLedgerStreamer({ rpc });
```

Archive access is separately optional: provide either `archiveRpc` or
`archiveRpcUrl` with optional `archiveAllowHttp`. It is not inferred from the
live client or `networkConfig`. Both clients must refer to the same network. For
URL construction, `allowHttp` defaults to `false`; `archiveAllowHttp` falls back
to the live URL/network's HTTP setting. Enable HTTP only for an intentionally
local/trusted service.

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
| `onCheckpoint`       | Awaited callback after a fully consumed ledger            |
| `checkpointInterval` | Ledger-number modulus for notifications; default `100`    |
| `onError`            | Synchronous decision callback; `false` stops and rethrows |
| `signal`             | Optional `AbortSignal`; cooperatively stops this run      |

Read [progress and recovery](recovery.md) before persisting or skipping data.

## Runtime access

`rpc`, `archiveRpc`, `isRunning`, and `nextLedger` expose configured clients and
lifecycle state. The property setters and URL-based method behave differently:

- Assigning `streamer.rpc = client` or `streamer.archiveRpc = client` rejects an
  assignment when that client is already configured, with `RPC_ALREADY_SET` or
  `ARCHIVE_RPC_ALREADY_SET`, respectively.
- Calling `streamer.setArchiveRpc(url, allowHttp?)` creates an archive client
  and **replaces any existing archive client**, including one configured through
  the constructor's `archiveRpcUrl`. It does not use the guarded property
  setter. Its `allowHttp` argument defaults to `false`.

Replacing the archive client changes the provider used by subsequent archive
reads. Prefer constructor configuration and a new streamer when changing
providers to keep each run's configuration explicit.

See the full types:
[RPCStreamerConfig](https://jsr.io/@colibri/rpc-streamer/doc/~/RPCStreamerConfig),
[StreamerOptions](https://jsr.io/@colibri/rpc-streamer/doc/~/StreamerOptions),
and
[start options](https://jsr.io/@colibri/rpc-streamer/doc/~/AutoStartOptions).
