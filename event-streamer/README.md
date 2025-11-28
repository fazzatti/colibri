# @colibri/event-streamer

A real-time event streaming client for Stellar/Soroban that supports both live and historical event ingestion. Part of the [Colibri](https://github.com/fazzatti/colibri) ecosystem.

[📚 Documentation](https://colibri-docs.gitbook.io/) | [💡 Examples](https://github.com/fazzatti/colibri-examples)

## Installation

```sh
# Deno (JSR)
deno add jsr:@colibri/event-streamer

# Node.js / npm
npm install @colibri/event-streamer
```

## Features

- **Live streaming** – Stream events in real-time using `getEvents` RPC endpoint
- **Historical ingestion** – Backfill events from archive nodes using `getLedgers`
- **Auto mode** – Seamlessly switch between historical and live modes based on ledger availability
- **Flexible filtering** – Use `EventFilter` from `@colibri/core` to select specific contracts, event types, or topic patterns
- **Deduplication** – Built-in circular buffer prevents duplicate event processing
- **Configurable intervals** – Fine-tune polling, paging, and archival intervals

## Quick start

```ts
import { EventStreamer } from "@colibri/event-streamer";
import { EventFilter, EventType, NetworkProviders } from "@colibri/core";
import { xdr } from "stellar-sdk";

const networkConfig = NetworkProviders.Lightsail.TestNet();

const filter = new EventFilter({
  type: EventType.Contract,
  contractIds: ["CABC..."],
  topics: [[xdr.ScVal.scvSymbol("transfer"), "**"]],
});

const streamer = new EventStreamer({
  rpcUrl: networkConfig.rpcUrl,
  filters: [filter],
});

await streamer.startLive(async (event) => {
  console.log("Event:", event.id, event.ledger);
});
```

## Streaming modes

### Live mode (`startLive`)

Streams events from the RPC's retention window using the `getEvents` endpoint. Best for real-time monitoring when you only need recent events.

```ts
await streamer.startLive(
  async (event) => {
    // Process each event
    console.log(event);
  },
  {
    startLedger: 12345678, // optional: defaults to latest ledger
    stopLedger: 12345700, // optional: run indefinitely if omitted
  }
);
```

**Throws:**

- `LEDGER_TOO_OLD` – If `startLedger` is outside the RPC retention window
- `LEDGER_TOO_HIGH` – If `startLedger` is ahead of the latest ledger
- `RPC_NOT_HEALTHY` – If the RPC is not responding

### Archive mode (`startArchive`)

Ingests historical events from an archive RPC using the `getLedgers` endpoint and XDR parsing. Requires an archive RPC to be configured.

```ts
const networkConfig = NetworkProviders.Lightsail.MainNet();

const streamer = new EventStreamer({
  rpcUrl: networkConfig.rpcUrl,
  archiveRpcUrl: networkConfig.archiveRpcUrl,
  filters: [filter],
});

await streamer.startArchive(
  async (event) => {
    console.log(event);
  },
  { startLedger: 1000000, stopLedger: 1000100 }
);
```

**Throws:**

- `MISSING_ARCHIVE_RPC` – If no archive RPC is configured
- `INVALID_INGESTION_RANGE` – If `startLedger > stopLedger`

### Auto mode (`start`)

Automatically switches between archive and live modes based on ledger availability. Ideal for applications that need to backfill historical data and then continue with live streaming.

```ts
const networkConfig = NetworkProviders.Lightsail.MainNet();

const streamer = new EventStreamer({
  rpcUrl: networkConfig.rpcUrl,
  archiveRpcUrl: networkConfig.archiveRpcUrl, // needed for historical
  filters: [filter],
});

await streamer.start(
  async (event) => {
    console.log(event);
  },
  { startLedger: 1000000, stopLedger: 2000000 }
);
```

**Behavior:**

1. If `startLedger` is within RPC retention → uses live mode
2. If `startLedger` is older than retention and archive RPC configured → uses archive mode until caught up
3. Automatically transitions from archive to live as ledgers become available
4. Re-checks availability after each historical batch (handles shifting retention windows)

## Configuration

### Constructor options

```ts
const networkConfig = NetworkProviders.Lightsail.MainNet();

const streamer = new EventStreamer({
  rpcUrl: networkConfig.rpcUrl,
  archiveRpcUrl: networkConfig.archiveRpcUrl, // optional
  filters: [filter1, filter2],
  options: {
    limit: 10,
    waitLedgerIntervalMs: 5000,
    pagingIntervalMs: 100,
    archivalIntervalMs: 500,
    skipLedgerWaitIfBehind: false,
  },
});
```

### Runtime configuration

```ts
// Update filters at runtime
streamer.setFilters([newFilter]);
streamer.clearFilters();

// Add archive RPC later
streamer.setArchiveRpc(networkConfig.archiveRpcUrl);
```

## Stopping the streamer

```ts
// Start in background (don't await immediately)
const streamPromise = streamer.start(handleEvent, { startLedger: 1000000 });

// Stop after some condition
setTimeout(() => {
  streamer.stop();
}, 60000);

// Wait for graceful shutdown
await streamPromise;
```

## Event structure

Events passed to your handler follow the Stellar SDK's event format:

```ts
interface Event {
  id: string; // Unique event ID
  type: string; // "contract" | "system" | "diagnostic"
  ledger: number; // Ledger sequence number
  contractId: {
    address(): Address; // Contract address helper
  };
  topic: xdr.ScVal[]; // Event topics
  value: xdr.ScVal; // Event data payload
}
```

## Error handling

All errors extend `ColibriError` from `@colibri/core`:

```ts
import * as E from "@colibri/event-streamer/error";

try {
  await streamer.startLive(handler, { startLedger: 1000 });
} catch (err) {
  if (err instanceof E.LEDGER_TOO_OLD) {
    console.log("Ledger outside retention:", err.meta);
  } else if (err instanceof E.RPC_NOT_HEALTHY) {
    console.log("RPC unavailable");
  } else if (err instanceof E.STREAMER_ALREADY_RUNNING) {
    console.log("Stop the current stream first");
  }
}
```

### Error types

| Error                      | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `PAGING_INTERVAL_TOO_LONG` | `pagingIntervalMs` exceeds `waitLedgerIntervalMs`    |
| `RPC_ALREADY_SET`          | Attempted to set RPC when already configured         |
| `ARCHIVE_RPC_ALREADY_SET`  | Attempted to set archive RPC when already configured |
| `STREAMER_ALREADY_RUNNING` | Called start while already streaming                 |
| `RPC_NOT_HEALTHY`          | RPC health check failed                              |
| `LEDGER_TOO_OLD`           | Requested ledger is outside RPC retention            |
| `LEDGER_TOO_HIGH`          | Requested ledger is ahead of latest                  |
| `MISSING_ARCHIVE_RPC`      | Archive operation without archive RPC configured     |
| `INVALID_INGESTION_RANGE`  | Invalid ledger range (start > stop)                  |

## Example: Continuous monitoring

```ts
import { EventStreamer } from "@colibri/event-streamer";
import { EventFilter, EventType, NetworkProviders } from "@colibri/core";
import { xdr } from "stellar-sdk";

const networkConfig = NetworkProviders.Lightsail.MainNet();

const filter = new EventFilter({
  type: EventType.Contract,
  contractIds: ["CABC..."],
  topics: [[xdr.ScVal.scvSymbol("mint"), "**"]],
});

const streamer = new EventStreamer({
  rpcUrl: networkConfig.rpcUrl,
  filters: [filter],
});

// Reconnect on error
while (true) {
  try {
    await streamer.startLive(async (event) => {
      console.log(`[${event.ledger}] ${event.id}`);
    });
  } catch (err) {
    console.error("Reconnecting in 5s:", err);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
```

## Related packages

- [`@colibri/core`](../core) – Core utilities including `EventFilter`, `parseEventsFromLedgerCloseMeta`, and network configuration
- [`@colibri/plugins`](../plugins) – Additional plugins for fee bumping, transaction recovery, and more
