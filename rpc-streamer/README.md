# @colibri/rpc-streamer

A generic RPC streaming framework for building custom Stellar data streamers. The `RPCStreamer<T>` class handles all the complex streaming logic—archive-to-live transitions, checkpoints, error handling, pagination—so you can focus on defining what data to extract.

## Overview

This package provides two ways to stream Stellar blockchain data:

1. **Pre-built Variants** - Ready-to-use streamers for common use cases (ledgers, events)
2. **Custom Streamers** - Build your own streamer for any data type using the generic `RPCStreamer<T>` class

## Installation

```bash
deno add jsr:@colibri/rpc-streamer
```

## Pre-built Variants

For common use cases, use the static factory methods:

### Streaming Ledgers

```typescript
import { RPCStreamer } from "@colibri/rpc-streamer";

const streamer = RPCStreamer.ledger({
  rpcUrl: "https://soroban-testnet.stellar.org",
});

await streamer.start(
  async (ledger) => {
    console.log(`Ledger ${ledger.sequence}: ${ledger.hash}`);
  },
  { startLedger: 1000000 },
);
```

### Streaming Events

```typescript
import { RPCStreamer } from "@colibri/rpc-streamer";
import { EventFilter, EventType } from "@colibri/core";

const streamer = RPCStreamer.event({
  rpcUrl: "https://soroban-testnet.stellar.org",
  filters: [new EventFilter({ type: EventType.Contract })],
});

await streamer.start(
  async (event) => {
    console.log(`Event ${event.id} from contract ${event.contractId}`);
  },
  { startLedger: 1000000 },
);
```

## Building Custom Streamers

For data types not covered by the pre-built variants, create a custom streamer by providing two ingestor functions:

- **`ingestLive`** - Fetches data from live RPC (recent ledgers within retention window)
- **`ingestArchive`** - Fetches historical data from archive RPC

### Example: Transaction Streamer

Here's a simple example that streams transactions:

```typescript
import { RPCStreamer } from "@colibri/rpc-streamer";
import type { ArchiveIngestFunc, LiveIngestFunc } from "@colibri/rpc-streamer";

// Define your data type
interface Transaction {
  hash: string;
  ledger: number;
  successful: boolean;
}

// Live ingestor: fetch transactions from recent ledgers
const ingestLive: LiveIngestFunc<Transaction> = async (
  rpc,
  ledgerSequence,
  onData,
  stopLedger,
) => {
  // Fetch transactions for this ledger from RPC
  const response = await rpc.getTransactions({ startLedger: ledgerSequence });

  for (const tx of response.transactions) {
    await onData({
      hash: tx.hash,
      ledger: tx.ledger,
      successful: tx.status === "SUCCESS",
    });
  }

  const latestLedger = response.latestLedger;
  const hitStop = stopLedger !== undefined && ledgerSequence >= stopLedger;

  return {
    nextLedger: ledgerSequence + 1,
    shouldWait: ledgerSequence >= latestLedger,
    hitStopLedger: hitStop,
  };
};

// Archive ingestor: fetch historical transactions
const ingestArchive: ArchiveIngestFunc<Transaction> = async (
  rpc,
  startLedger,
  stopLedger,
  onData,
  context,
) => {
  let cursor: string | undefined;
  let currentLedger = startLedger;

  while (context.isRunning() && currentLedger <= stopLedger) {
    const response = await rpc.getTransactions({
      startLedger: currentLedger,
      cursor,
    });

    for (const tx of response.transactions) {
      await onData({
        hash: tx.hash,
        ledger: tx.ledger,
        successful: tx.status === "SUCCESS",
      });
      currentLedger = tx.ledger;
    }

    // Report checkpoint progress if configured
    if (context.onCheckpoint) {
      context.onCheckpoint(currentLedger);
    }

    cursor = response.cursor;
    if (!cursor) break;
  }

  return currentLedger;
};

// Create the custom streamer
const streamer = new RPCStreamer<Transaction>({
  rpcUrl: "https://soroban-testnet.stellar.org",
  archiveRpcUrl: "https://archive-rpc.example.com",
  ingestLive,
  ingestArchive,
});

// Use it like any other streamer
await streamer.start(
  async (tx) => {
    console.log(`Transaction ${tx.hash} in ledger ${tx.ledger}`);
  },
  { startLedger: 1000000 },
);
```

> **Note:** Both `ingestLive` and `ingestArchive` are optional. Provide only the ones you need—if you only want live streaming, you can omit `ingestArchive`. The streamer will throw an error if you try to use a mode without the required ingestor.

## Streaming Modes

All streamers (pre-built and custom) support three streaming modes:

### Auto Mode (`start`)

Automatically uses archive RPC for historical data and transitions to live RPC when caught up:

```typescript
const streamer = RPCStreamer.ledger({
  rpcUrl: "https://soroban-testnet.stellar.org",
  archiveRpcUrl: "https://archive-rpc.example.com",
});

await streamer.start(
  async (ledger) => {
    console.log(`Ledger: ${ledger.sequence}`);
  },
  {
    startLedger: 50000000, // Historical ledger
    stopLedger: 50001000, // Optional stop point
  },
);
```

### Live-Only Mode (`startLive`)

Stream only from live RPC (must be within retention window):

```typescript
await streamer.startLive(
  async (ledger) => {
    console.log(`Live ledger: ${ledger.sequence}`);
  },
  { startLedger: 50000000 },
);
```

### Archive-Only Mode (`startArchive`)

Stream only from archive RPC:

```typescript
await streamer.startArchive(
  async (ledger) => {
    console.log(`Historical ledger: ${ledger.sequence}`);
  },
  {
    startLedger: 1000000,
    stopLedger: 1001000,
  },
);
```

## Configuration

### Streamer Options

```typescript
const streamer = RPCStreamer.ledger({
  rpcUrl: "https://soroban-testnet.stellar.org",
  archiveRpcUrl: "https://archive-rpc.example.com",
  options: {
    waitLedgerIntervalMs: 5000, // Wait between ledger checks in live mode (default: 5000)
    pagingIntervalMs: 100, // Wait between pagination requests (default: 100)
    archivalIntervalMs: 500, // Wait between archive fetches (default: 500)
    skipLedgerWaitIfBehind: true, // Skip waiting when catching up (default: false)
    limit: 10, // Max items per request (default: 10)
  },
});
```

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

## API Reference

### `RPCStreamer<T>`

Generic streaming class that can be used directly for custom streamers or via static factories.

#### Constructor

```typescript
new RPCStreamer<T>({
  rpcUrl: string,
  archiveRpcUrl?: string,
  ingestLive?: LiveIngestFunc<T>,    // Required for startLive and start
  ingestArchive?: ArchiveIngestFunc<T>, // Required for startArchive and start (with historical data)
  options?: StreamerOptions,
})
```

#### Static Methods

- `RPCStreamer.ledger(config)` - Create ledger streamer
- `RPCStreamer.event(config)` - Create event streamer

#### Instance Methods

- `start(callback, options?)` - Auto-mode streaming (archive then live)
- `startLive(callback, options?)` - Live-only streaming
- `startArchive(callback, options)` - Archive-only streaming (requires start/stop ledgers)
- `stop()` - Stop streaming
- `setArchiveRpc(url)` - Set archive RPC by URL

#### Properties

- `rpc` - The live RPC server instance
- `archiveRpc` - The archive RPC server instance (if configured)
- `isRunning` - Whether stream is active

### Event Streamer Config

```typescript
interface EventStreamerConfig {
  rpcUrl: string;
  archiveRpcUrl?: string;
  filters?: EventFilter[];
  options?: StreamerOptions;
}
```

### Ledger Streamer Config

```typescript
interface LedgerStreamerConfig {
  rpcUrl: string;
  archiveRpcUrl?: string;
  options?: StreamerOptions;
}
```

## License

MIT

## Related Packages

- [@colibri/core](../core) - Core Stellar SDK with Event, Ledger, and EventFilter types
