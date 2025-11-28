# Core Package Overview

The `@colibri/core` package is the foundation of the Colibri toolkit. It provides all the essential primitives for building Stellar and Soroban applications.

## Installation

```bash
deno add jsr:@colibri/core
```

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
  PIPE_InvokeContract,
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

## Next Steps

- [Error Handling](error.md) — Understand the error system
- [Pipelines](pipelines/README.md) — Build transaction workflows
- [Events Overview](../events/overview.md) — Parse and filter contract events
