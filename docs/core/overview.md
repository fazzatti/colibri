# Core Package Overview

The `@colibri/core` package is the foundation of the Colibri toolkit. It provides all the essential primitives for building Stellar and Soroban applications.

## Installation

```bash
deno add jsr:@colibri/core
```

## Architecture at a Glance

The core package is organized around a few clear boundaries:

- **Processes** are raw single-purpose functions such as `buildTransaction` and `sendTransaction`
- **Steps** are `convee` wrappers with stable ids exposed under `steps`
- **Pipelines** are composed flows such as `PIPE_InvokeContract`
- **Auth** and **address** hold reusable domain logic that should not live in pipelines
- **Errors** are typed and stable across all modules

## Quick Import Examples

### Network Setup

```typescript
import { NetworkConfig, NetworkProviders } from "@colibri/core";

// Use built-in defaults
const testnet = NetworkConfig.TestNet();
const mainnet = NetworkConfig.MainNet();

// Use a specific provider (with archive support)
const lightsail = NetworkProviders.Lightsail.MainNet();
```

### Account Management

```typescript
import { NativeAccount, LocalSigner } from "@colibri/core";

// From address
const account = NativeAccount.fromAddress("GABC...");

// From signer
const signer = LocalSigner.fromSecret("S...");
const signableAccount = NativeAccount.fromMasterSigner(signer);
```

### Transaction Pipelines

```typescript
import { PIPE_InvokeContract, LocalSigner, NetworkConfig } from "@colibri/core";
import { Operation } from "stellar-sdk";

const network = NetworkConfig.TestNet();
const signer = LocalSigner.fromSecret("S...");

// Create and run the pipeline
const pipeline = PIPE_InvokeContract.create({ networkConfig: network });
const result = await pipeline.run({
  operations: [
    Operation.invokeContractFunction({
      contract: "CABC...",
      function: "transfer",
      args: [
        /* ScVal args */
      ],
    }),
  ],
  config: {
    source: signer.publicKey(),
    fee: "100000",
    timeout: 30,
    signers: [signer],
  },
});
```

### Event Parsing

```typescript
import { SACEvents, EventFilter, EventType } from "@colibri/core";

// Create a filter for transfer events
const filter = new EventFilter({
  contractIds: ["C..."],
  type: EventType.Contract,
  topics: [SACEvents.TransferEvent.toTopicFilter()],
});

// Parse a raw event into a typed object
const transfer = SACEvents.TransferEvent.fromEvent(rawEvent);
console.log(transfer.from, transfer.to, transfer.amount);
```

### Ledger Parsing

```typescript
import { Ledger } from "@colibri/core";

// Parse ledger data from RPC response
const response = await rpc.getLedgers({
  startLedger: 1000,
  pagination: { limit: 1 },
});
const ledger = Ledger.fromEntry(response.ledgers[0]);

console.log(`Ledger ${ledger.sequence} (version: ${ledger.version})`);
console.log(`Transactions: ${ledger.transactions.length}`);

// Access transaction details
for (const tx of ledger.transactions) {
  console.log(`TX ${tx.hash}: ${tx.operationCount} operations`);
  for (const op of tx.operations) {
    console.log(`  - ${op.type}`);
  }
}
```

### Error Handling

```typescript
import { ColibriError } from "@colibri/core";

// All pipeline operations can throw ColibriError
try {
  const result = await pipeline.run({...});
  console.log("TX Hash:", result.hash);
} catch (error) {
  if (error instanceof ColibriError) {
    // Handle specific error codes
    console.log("Error code:", error.code);
    console.log("Details:", error.details);
  }
}
```

## Type Exports

The core package exports both runtime values and types:

```typescript
// Runtime exports
import {
  NetworkConfig,
  LocalSigner,
  NativeAccount,
  EventFilter,
  SACEvents,
  Ledger,
  PIPE_InvokeContract,
  steps,
  address,
  auth,
} from "@colibri/core";

// Type-only exports
import type {
  Ed25519PublicKey,
  Ed25519SecretKey,
  ContractId,
  Signer,
  NetworkType,
  EventHandler,
} from "@colibri/core";
```

## Error Handling

Colibri uses a structured error system with unique codes:

```typescript
import { ColibriError } from "@colibri/core";

try {
  const result = await pipeline.run({...});
} catch (error) {
  if (error instanceof ColibriError) {
    console.log("Code:", error.code);       // e.g., "BTX_003"
    console.log("Source:", error.source);   // e.g., "@colibri/core/processes/build-transaction"
    console.log("Message:", error.message);
    console.log("Details:", error.details);
  }
}
```

## Processes, Steps, and Pipelines

Most transaction flows use the same progression:

- call raw process functions when you need isolated behavior
- use `steps` when you need stable orchestration ids or plugin targets
- use `PIPE_*` factories when you want the end-to-end flows Colibri ships with

This keeps business logic in plain functions while leaving `convee` details at the orchestration boundary.

## Next Steps

- [Error Handling](error.md) — Understand the error system
- [Pipelines](pipelines/README.md) — Build transaction workflows
- [Steps](steps.md) — See the orchestration wrappers and stable ids
- [Processes](processes/README.md) — Work with the raw building blocks
- [Events Overview](../events/overview.md) — Parse and filter contract events
- [RPC Streamer](../packages/rpc-streamer.md) — Stream ledgers and events
