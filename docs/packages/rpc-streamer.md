# RPC Streamer

The `@colibri/rpc-streamer` package provides a generic RPC streaming framework for Stellar blockchain data. It handles all the complex streaming logic—archive-to-live transitions, checkpoints, error handling, pagination—so you can focus on processing data.

## Installation

```bash
deno add jsr:@colibri/rpc-streamer
```

## Overview

This package provides two ways to stream Stellar blockchain data:

1. **Pre-built Variants** — Ready-to-use streamers for events and ledgers
2. **Custom Streamers** — Build your own streamer for any data type using the generic `RPCStreamer<T>` class

All streamers support:

- **Live mode** — Streams data from ledgers within the RPC retention window (~7 days)
- **Archive mode** — Fetches historical data from past ledgers using archive nodes
- **Auto mode** — Automatically detects which mode to use and transitions between them seamlessly

## Quick Start

### Streaming Events

```typescript
import { RPCStreamer } from "@colibri/rpc-streamer";
import { EventFilter, EventType } from "@colibri/core";

const streamer = RPCStreamer.event({
  rpcUrl: "https://soroban-testnet.stellar.org",
  archiveRpcUrl: "https://archive-rpc.example.com",
  filters: [new EventFilter({ type: EventType.Contract })],
});

await streamer.start(
  async (event) => {
    console.log(`Event ${event.id} from contract ${event.contractId}`);
  },
  { startLedger: 1000000 },
);
```

### Streaming Ledgers

```typescript
import { RPCStreamer } from "@colibri/rpc-streamer";

const streamer = RPCStreamer.ledger({
  rpcUrl: "https://soroban-testnet.stellar.org",
  archiveRpcUrl: "https://archive-rpc.example.com",
});

await streamer.start(
  async (ledger) => {
    console.log(`Ledger ${ledger.sequence}: ${ledger.hash}`);
  },
  { startLedger: 1000000 },
);
```

For complete working examples, see the [rpc-streamer examples repository](https://github.com/fazzatti/colibri-examples/tree/main/examples/rpc-streamer).

## Static Factory Methods

### `RPCStreamer.event(config)`

Creates a pre-configured event streamer.

```typescript
const streamer = RPCStreamer.event({
  rpcUrl: string;
  archiveRpcUrl?: string;
  filters?: EventFilter[];
  options?: StreamerOptions;
});
```

### `RPCStreamer.ledger(config)`

Creates a pre-configured ledger streamer.

```typescript
const streamer = RPCStreamer.ledger({
  rpcUrl: string;
  archiveRpcUrl?: string;
  options?: StreamerOptions;
});
```

## Streaming Modes

### Auto Mode (`start`)

Automatically uses archive RPC for historical data and transitions to live RPC when caught up:

```typescript
await streamer.start(handler, {
  startLedger: 50000000, // Historical ledger
  stopLedger: 50001000, // Optional stop point
});
```

### Live-Only Mode (`startLive`)

Stream only from live RPC. The `startLedger` must be within the retention window:

```typescript
await streamer.startLive(handler, { startLedger: 50000000 });
```

### Archive-Only Mode (`startArchive`)

Stream only from archive RPC. Requires `archiveRpcUrl` to be configured:

```typescript
await streamer.startArchive(handler, {
  startLedger: 1000000,
  stopLedger: 1001000,
});
```

## Configuration

### Streamer Options

```typescript
interface StreamerOptions {
  limit?: number; // Max items per request (default: 10)
  waitLedgerIntervalMs?: number; // Wait between ledger checks in live mode (default: 5000)
  pagingIntervalMs?: number; // Wait between pagination requests (default: 100)
  archivalIntervalMs?: number; // Wait between archive fetches (default: 500)
  skipLedgerWaitIfBehind?: boolean; // Skip waiting when catching up (default: false)
}
```

| Option                   | Default | Description                             |
| ------------------------ | ------- | --------------------------------------- |
| `limit`                  | `10`    | Max items per request                   |
| `waitLedgerIntervalMs`   | `5000`  | Polling interval for new ledgers (ms)   |
| `pagingIntervalMs`       | `100`   | Delay between pagination requests (ms)  |
| `archivalIntervalMs`     | `500`   | Delay between archive fetches (ms)      |
| `skipLedgerWaitIfBehind` | `false` | Skip waiting when catching up to latest |

### Start Options

```typescript
await streamer.start(callback, {
  startLedger: 1000000, // Starting ledger (defaults to latest)
  stopLedger: 1001000, // Ending ledger (optional, streams indefinitely if omitted)
  onCheckpoint: (ledger) => {
    // Called periodically for progress persistence
    db.saveProgress(ledger);
  },
  checkpointInterval: 100, // Checkpoint every N ledgers (default: 100)
  onError: (error, ledger) => {
    // Handle errors gracefully
    console.error(`Error at ledger ${ledger}:`, error);
    return true; // Return true to continue, false to stop
  },
});
```

## Stopping and Resuming

```typescript
// Stop the streamer
streamer.stop();

// Check if running
if (streamer.isRunning) {
  console.log("Streamer is active");
}

// Resume from checkpoint
const lastProcessed = await db.getProgress();
await streamer.start(callback, { startLedger: lastProcessed + 1 });
```

## Building Custom Streamers

For data types not covered by the pre-built variants, create a custom streamer by providing ingestor functions:

```typescript
import { RPCStreamer } from "@colibri/rpc-streamer";
import type { ArchiveIngestFunc, LiveIngestFunc } from "@colibri/rpc-streamer";

interface MyData {
  id: string;
  ledger: number;
}

const ingestLive: LiveIngestFunc<MyData> = async (
  rpc,
  ledgerSequence,
  onData,
  stopLedger,
) => {
  // Fetch data for this ledger
  // Call onData() for each item
  return {
    nextLedger: ledgerSequence + 1,
    shouldWait: true,
    hitStopLedger: false,
  };
};

const ingestArchive: ArchiveIngestFunc<MyData> = async (
  rpc,
  startLedger,
  stopLedger,
  onData,
  context,
) => {
  // Fetch historical data
  // Call onData() for each item
  return currentLedger;
};

const streamer = new RPCStreamer<MyData>({
  rpcUrl: "https://soroban-testnet.stellar.org",
  archiveRpcUrl: "https://archive-rpc.example.com",
  ingestLive,
  ingestArchive,
});
```

> **Note:** Both `ingestLive` and `ingestArchive` are optional. Provide only the ones you need—if you only want live streaming, you can omit `ingestArchive`. The streamer will throw an error if you try to use a mode without the required ingestor.

## Error Handling

All errors are instances of `RPCStreamerError` with specific error codes:

```typescript
import { RPCStreamerError, RPCStreamerErrorCode } from "@colibri/rpc-streamer";

try {
  await streamer.start(callback, options);
} catch (error) {
  if (error instanceof RPCStreamerError) {
    console.error(`Error ${error.code}: ${error.message}`);
  }
}
```

| Code      | Description                                  |
| --------- | -------------------------------------------- |
| `RPC_001` | Paging interval exceeds wait ledger interval |
| `RPC_002` | RPC client already assigned                  |
| `RPC_003` | Archive RPC client already assigned          |
| `RPC_004` | Streamer instance already running            |
| `RPC_005` | RPC health check failed                      |
| `RPC_006` | Requested ledger older than retention window |
| `RPC_007` | Requested ledger higher than latest          |
| `RPC_008` | Archive RPC required but not configured      |
| `RPC_009` | Invalid ingestion range specified            |
| `RPC_017` | Live ingestor not provided                   |
| `RPC_018` | Archive ingestor not provided                |

## Examples

For complete working examples, see the [rpc-streamer examples](https://github.com/fazzatti/colibri-examples/tree/main/examples/rpc-streamer).
