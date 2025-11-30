# Event Streamer

The `@colibri/event-streamer` package provides real-time and historical Soroban event ingestion. It intelligently handles both live streaming from the RPC retention window (~7 days) and archive ingestion from older ledgers, automatically switching between modes as needed.

## Installation

```bash
deno add jsr:@colibri/event-streamer
```

## Overview

The Event Streamer solves the challenge of ingesting Soroban contract events across different time ranges:

- **Live mode** — Streams events from ledgers within the RPC retention window using `getEvents`
- **Archive mode** — Fetches historical events from past ledgers using `getLedgers` on archive nodes
- **Auto mode** — Automatically detects which mode to use and transitions between them seamlessly

This allows you to backfill historical data and continue with real-time streaming without manual intervention.

## Quick Start

```typescript
const streamer = new EventStreamer({
  rpcUrl: network.rpcUrl,
  archiveRpcUrl: network.archiveRpcUrl,
  filters: [filter],
});

// Start streaming — automatically chooses live or archive mode
await streamer.start(
  (event) => {
    console.log(`Event: ${event.id} at ledger ${event.ledger}`);
  },
  { startLedger, stopLedger }
);
```

For complete working examples, see the [event-streamer examples repository](https://github.com/fazzatti/colibri-examples/tree/main/examples/event-streamer).

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

Start event ingestion with automatic mode detection. See [Ingestion Modes](#ingestion-modes) for details.

```typescript
await streamer.start(handler, { startLedger, stopLedger });
```

### `stop()`

Stop the event streamer:

```typescript
streamer.stop();
```

## Ingestion Modes

### Live Mode

Streams events from ledgers within the RPC retention window (~7 days) using `getEvents`:

```typescript
await streamer.start(handler); // Starts from latest
await streamer.start(handler, { stopLedger }); // Stop at specific ledger
```

Use `startLive()` to explicitly require live mode — throws if `startLedger` is outside the retention window.

### Archive Mode

Fetches historical events from ledgers outside the retention window using `getLedgers`:

```typescript
await streamer.start(handler, {
  startLedger: 59895694,
  stopLedger: 59895694,
});
```

Requires `archiveRpcUrl` to be configured. Use `startArchive()` to explicitly use archive mode.

### Auto Mode

The `start()` method automatically detects and switches between modes:

- If `startLedger` is within retention → uses live mode
- If `startLedger` is outside retention → starts in archive mode, transitions to live when reaching the retention window

This enables seamless backfilling of historical data followed by continuous real-time streaming.

## Event Handler

The event handler receives raw events with XDR-encoded topics and values:

```typescript
type EventHandler = (event: RawEvent) => void | Promise<void>;
```

For parsing and working with events, see the `@colibri/core` event utilities:

- [Standardized Events](../events/standardized-events/README.md) — SAC and SEP-41 event parsers
- [Event Filter](../events/event-filter.md) — Configure filters

## Error Handling

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

## Examples

For complete working examples, see the [event-streamer examples](https://github.com/fazzatti/colibri-examples/tree/main/examples/event-streamer).
