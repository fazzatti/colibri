# Quick Start

This guide walks you through building and submitting your first Soroban contract invocation with Colibri.

## Setup

First, make sure you have [installed](installation.md) the core package:

```bash
deno add jsr:@colibri/core
```

## Your First Contract Call

Let's invoke a simple contract method on TestNet using the `Contract` class:

```typescript
import {
  NetworkConfig,
  LocalSigner,
  Contract,
  initializeWithFriendbot,
} from "@colibri/core";

// 1. Configure the network
const network = NetworkConfig.TestNet();

// 2. Create a new random signer (or use an existing secret key)
const signer = LocalSigner.generateRandom();
console.log("Public Key:", signer.publicKey());

// 3. Fund the account on TestNet using Friendbot
await initializeWithFriendbot(network.friendbotUrl, signer.publicKey());
console.log("Account funded!");

// 4. Create a contract instance
const contract = Contract.create({
  networkConfig: network,
  contractConfig: {
    contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  },
});

// 5. Invoke a contract method
const result = await contract.invoke({
  method: "hello",
  methodArgs: { to: "World" },
  config: {
    source: signer.publicKey(),
    fee: "100000",
    signers: [signer],
  },
});

// 6. Handle the result
console.log("✅ Transaction successful!");
console.log("   Hash:", result.hash);
console.log("   Return Value:", result.returnValue);
```

## Using Pipelines Directly

For more control, use the pipeline API directly:

```typescript
import {
  NetworkConfig,
  LocalSigner,
  PIPE_InvokeContract,
  initializeWithFriendbot,
} from "@colibri/core";
import { Operation } from "stellar-sdk";

// Configure network and signer
const network = NetworkConfig.TestNet();
const signer = LocalSigner.generateRandom();
await initializeWithFriendbot(network.friendbotUrl, signer.publicKey());

// Create the pipeline
const pipeline = PIPE_InvokeContract.create({
  networkConfig: network,
});

// Build the operation
const operation = Operation.invokeContractFunction({
  contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  function: "hello",
  args: [
    /* ScVal arguments */
  ],
});

// Run the pipeline
const result = await pipeline.run({
  operations: [operation],
  config: {
    source: signer.publicKey(),
    fee: "100000",
    timeout: 30,
    signers: [signer],
  },
});

console.log("TX Hash:", result.hash);
```

## Reading Contract State

To read data from a contract without submitting a transaction:

```typescript
import { Contract, NetworkConfig } from "@colibri/core";

const network = NetworkConfig.TestNet();

const contract = Contract.create({
  networkConfig: network,
  contractConfig: {
    contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  },
});

// Read-only call (no transaction needed)
const count = await contract.read({
  method: "get_count",
  methodArgs: {},
});

console.log("Current count:", count);
```

## Streaming Events

To listen for contract events in real-time:

```typescript
import { EventStreamer } from "@colibri/event-streamer";
import { EventFilter, EventType, SACEvents } from "@colibri/core";

// Create a filter for transfer events
const filter = new EventFilter({
  contractIds: ["CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"],
  type: EventType.Contract,
  topics: [SACEvents.TransferEvent.toTopicFilter()],
});

// Create the streamer
const streamer = new EventStreamer({
  rpcUrl: network.rpcUrl,
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

## Understanding Error Handling

Colibri uses typed errors that extend `ColibriError`. Each error includes:

- `code` — Unique error code (e.g., `BTX_003`, `SIM_001`)
- `message` — Human-readable message
- `details` — Additional context
- `diagnostic` — Suggestions and references (when available)
- `meta.cause` — Original error if wrapped

```typescript
try {
  const result = await pipeline.run({...});
  console.log("Success:", result.hash);
} catch (error) {
  if (error instanceof ColibriError) {
    console.error("Error Code:", error.code);
    console.error("Message:", error.message);
    console.error("Details:", error.details);

    if (error.diagnostic) {
      console.error("Suggestion:", error.diagnostic.suggestion);
    }
  }
}
```

## Next Steps

- [Architecture Overview](architecture.md) — Understand pipelines, processes, and error handling
- [Contract](../core/contract.md) — Deep dive into contract interactions
- [Pipelines](../core/pipelines/README.md) — Learn about transaction pipelines
- [Events](../events/overview.md) — Learn about event parsing and streaming
