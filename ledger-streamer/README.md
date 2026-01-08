# @colibri/ledger-streamer

Streaming client for Stellar blockchain ledgers with support for live, archival, and auto-switching modes. Provides continuous ingestion of complete ledger data including transactions, operations, and header metadata — ideal for building indexers, analytics pipelines, and blockchain explorers.

> For event-specific streaming/ingestion, see the dedicated `@colibri/event-streamer` package.

## Installation

```bash
deno add jsr:@colibri/ledger-streamer
```

## Quick Start

```typescript
import { LedgerStreamer } from "@colibri/ledger-streamer";

const streamer = new LedgerStreamer({
  rpcUrl: "https://soroban-testnet.stellar.org",
  archiveRpcUrl: "https://archive.stellar.org", // Optional, for historical data
});

// Stream ledgers with auto mode (archive → live transition)
await streamer.start(
  async (ledger) => {
    console.log(`Ledger ${ledger.sequence}`);
    console.log(`  Transactions: ${ledger.transactions.length}`);
    console.log(`  Close time: ${ledger.closeTime}`);

    for (const tx of ledger.transactions) {
      console.log(`  TX ${tx.hash}: ${tx.operations.length} operations`);
    }
  },
  { startLedger: 1000000 }
);
```

## Streaming Modes

### 1. Live Mode

Stream from the RPC's retention window forward:

```typescript
await streamer.startLive(handler, { startLedger: 1000000 });
```

### 2. Archive Mode

Stream historical data from an archival RPC:

```typescript
await streamer.startArchive(handler, {
  startLedger: 1,
  stopLedger: 999999,
});
```

### 3. Auto Mode (Recommended)

Seamlessly transition from archive to live streaming:

```typescript
await streamer.start(handler, { startLedger: 1 });
// Automatically uses archive RPC for old ledgers,
// then switches to live RPC when caught up
```

## Configuration

```typescript
const streamer = new LedgerStreamer({
  rpcUrl: "https://soroban-testnet.stellar.org",
  archiveRpcUrl: "https://archive.stellar.org",
  options: {
    batchSize: 1, // Ledgers per RPC request (default: 1)
    waitLedgerIntervalMs: 5000, // Wait between ledger checks (default: 5000)
    archivalIntervalMs: 500, // Wait between archive fetches (default: 500)
    skipLedgerWaitIfBehind: false, // Skip wait when catching up (default: false)
  },
});
```

## Checkpointing

Persist progress for crash recovery:

```typescript
await streamer.start(handler, {
  startLedger: lastCheckpoint + 1,
  onCheckpoint: (ledgerSequence) => {
    database.saveCheckpoint(ledgerSequence);
  },
  checkpointInterval: 100, // Checkpoint every 100 ledgers
});
```

## Error Handling

```typescript
await streamer.start(handler, {
  startLedger: 1000000,
  onError: (error, ledgerSequence) => {
    console.error(`Error at ledger ${ledgerSequence}:`, error);
    // Implement retry logic, alerting, etc.
  },
});
```

## Stopping

```typescript
// Start in background
const promise = streamer.start(handler, { startLedger: 1000000 });

// Stop gracefully
setTimeout(() => streamer.stop(), 60000);

await promise; // Resolves after stop
```

## License

MIT
