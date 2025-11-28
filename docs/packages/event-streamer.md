# Event Streamer

The `@colibri/event-streamer` package provides real-time and historical Soroban event ingestion.

## Installation

```bash
deno add jsr:@colibri/event-streamer
```

## Quick Start

```typescript
import { EventStreamer } from "@colibri/event-streamer";
import {
  EventFilter,
  EventType,
  SACEvents,
  NetworkProviders,
} from "@colibri/core";

const network = NetworkProviders.Lightsail.MainNet();

// Create a filter
const filter = new EventFilter({
  contractIds: ["CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"],
  type: EventType.Contract,
  topics: [SACEvents.TransferEvent.toTopicFilter()],
});

// Create the streamer
const streamer = new EventStreamer({
  rpcUrl: network.rpcUrl,
  archiveRpcUrl: network.archiveRpcUrl,
  filters: [filter],
});

// Start streaming
await streamer.start((event) => {
  const transfer = SACEvents.TransferEvent.fromEvent(event);
  console.log(
    `Transfer: ${transfer.from} → ${transfer.to}: ${transfer.amount}`
  );
});
```

## Constructor

```typescript
const streamer = new EventStreamer({
  rpcUrl: string;
  archiveRpcUrl?: string;
  filters: EventFilter[];
  options?: StreamerOptions;
});
```

### Parameters

| Parameter       | Type              | Required | Description                     |
| --------------- | ----------------- | -------- | ------------------------------- |
| `rpcUrl`        | `string`          | Yes      | Soroban RPC endpoint            |
| `archiveRpcUrl` | `string`          | —        | Archive RPC for historical data |
| `filters`       | `EventFilter[]`   | —        | Event filters (up to 5)         |
| `options`       | `StreamerOptions` | —        | Configuration options           |

### Options

```typescript
interface StreamerOptions {
  limit?: number; // Default: 10
  waitLedgerIntervalMs?: number; // Default: 5000
  pagingIntervalMs?: number; // Default: 100
  archivalIntervalMs?: number; // Default: 500
  skipLedgerWaitIfBehind?: boolean; // Default: false
}
```

| Option                   | Default | Description                             |
| ------------------------ | ------- | --------------------------------------- |
| `limit`                  | `10`    | Max events per request                  |
| `waitLedgerIntervalMs`   | `5000`  | Polling interval for new ledgers (ms)   |
| `pagingIntervalMs`       | `100`   | Delay between pagination requests (ms)  |
| `archivalIntervalMs`     | `500`   | Delay between archive fetches (ms)      |
| `skipLedgerWaitIfBehind` | `false` | Skip waiting when catching up to latest |

## Methods

### `start(handler, options?)`

Start event ingestion with automatic mode detection:

```typescript
await streamer.start(
  (event) => {
    // Handle each event
    console.log(event);
  },
  {
    startLedger: number, // Starting ledger (optional)
    stopLedger: number, // Stopping ledger (optional)
  }
);
```

The `start` method automatically determines whether to use live or archive ingestion based on:

- If `startLedger` is within RPC retention window → **Live mode**
- If `startLedger` is outside retention window → **Archive mode**
- If `startLedger` is omitted → Starts from latest ledger in **Live mode**

### `startLive(handler, options?)`

Explicitly start live ingestion:

```typescript
await streamer.startLive((event) => console.log(event), {
  startLedger: number,
  stopLedger: number,
});
```

{% hint style="warning" %}
**Throws error** if `startLedger` is outside the RPC retention window.
{% endhint %}

### `startArchive(handler, options?)`

Explicitly start archive ingestion:

```typescript
await streamer.startArchive((event) => console.log(event), {
  startLedger: number, // Required for archive
  stopLedger: number,
});
```

{% hint style="info" %}
Requires `archiveRpcUrl` to be configured.
{% endhint %}

### `stop()`

Stop the event streamer:

```typescript
streamer.stop();
```

### `getLatestLedger()`

Get the latest ledger from RPC:

```typescript
const ledger = await streamer.getLatestLedger();
console.log("Latest ledger:", ledger);
```

## Ingestion Modes

### Live Mode

Streams events from ledgers within the RPC retention window (~17 days):

```typescript
// Start from latest ledger
await streamer.start(handler);

// Start from specific recent ledger
await streamer.start(handler, { startLedger: recentLedger });

// Stop after specific ledger
await streamer.start(handler, { stopLedger: targetLedger });
```

### Archive Mode

Fetches events from historical ledgers using archive RPC:

```typescript
const streamer = new EventStreamer({
  rpcUrl: network.rpcUrl,
  archiveRpcUrl: network.archiveRpcUrl, // Required!
  filters: [filter],
});

// Ingest specific historical ledger
await streamer.start(handler, {
  startLedger: 59895694,
  stopLedger: 59895694,
});
```

### Auto Mode

The `start()` method automatically switches between modes:

```typescript
// If historical → starts in archive mode
// Transitions to live mode when reaching retention window
await streamer.start(handler, {
  startLedger: 50000000, // Historical
  // No stopLedger = continues indefinitely
});
```

## Event Handler

The event handler receives raw events:

```typescript
type EventHandler = (event: RawEvent) => void | Promise<void>;

interface RawEvent {
  type: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId: string;
  id: string;
  pagingToken: string;
  topic: xdr.ScVal[];
  value: xdr.ScVal;
  inSuccessfulContractCall: boolean;
  txHash: string;
}
```

### Parsing Events

Use event templates to parse raw events:

```typescript
import { SACEvents } from "@colibri/core";

await streamer.start((event) => {
  // Check event type and parse
  if (SACEvents.TransferEvent.is(event)) {
    const transfer = SACEvents.TransferEvent.fromEvent(event);
    console.log(transfer.from, transfer.to, transfer.amount);
  } else if (SACEvents.MintEvent.is(event)) {
    const mint = SACEvents.MintEvent.fromEvent(event);
    console.log(mint.to, mint.amount);
  }
});
```

## Error Handling

### Error Codes

| Code      | Class                      | Description                                  |
| --------- | -------------------------- | -------------------------------------------- |
| `EVS_001` | `PAGING_INTERVAL_TOO_LONG` | Paging interval exceeds wait ledger interval |
| `EVS_002` | `RPC_ALREADY_SET`          | RPC client already assigned                  |
| `EVS_003` | `ARCHIVE_RPC_ALREADY_SET`  | Archive RPC client already assigned          |
| `EVS_004` | `STREAMER_ALREADY_RUNNING` | Streamer instance already running            |
| `EVS_005` | `RPC_NOT_HEALTHY`          | RPC health check failed                      |
| `EVS_006` | `LEDGER_TOO_OLD`           | Requested ledger older than retention window |
| `EVS_007` | `LEDGER_TOO_HIGH`          | Requested ledger higher than latest          |
| `EVS_008` | `MISSING_ARCHIVE_RPC`      | Archive RPC required but not configured      |
| `EVS_009` | `INVALID_INGESTION_RANGE`  | Invalid ingestion range specified            |

### Error Handling Example

```typescript
try {
  await streamer.start(handler, { startLedger: 1 });
} catch (error) {
  if (error.code === "EVS_006") {
    console.log("Ledger too old - use archive mode");
  } else if (error.code === "EVS_008") {
    console.log("Configure archiveRpcUrl for historical data");
  }
}
```

## Examples

For complete working examples, see the [event-streamer examples](https://github.com/fazzatti/colibri-examples/tree/main/examples/event-streamer).

## Next Steps

- [Events Overview](../events/overview.md) — Understanding event structure
- [Standardized Events](../events/standardized-events/README.md) — SAC and SEP-41 event parsers
- [Event Filter](../events/event-filter.md) — Configure filters
