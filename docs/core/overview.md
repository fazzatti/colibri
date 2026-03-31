# Core Package Overview

`@colibri/core` is the foundation package for the Colibri toolkit. It exposes
the main clients, transaction configuration types, low-level process
functions, step factories, built-in pipelines, event helpers, and tooling.

## Installation

```bash
deno add jsr:@colibri/core
```

## Architecture At A Glance

- **Processes** are raw single-purpose functions such as `buildTransaction`
  and `sendTransaction`
- **Steps** are `convee` wrappers with stable ids under `steps`
- **Pipelines** are built with `create*Pipeline(...)` factory functions
- **Clients** such as `Contract` and `StellarAssetContract` own those
  pipelines internally
- **Errors** are typed, stable, and source-aware

## Quick Import Examples

### Network Setup

```ts
import { NetworkConfig, NetworkProviders } from "@colibri/core";

const testnet = NetworkConfig.TestNet();
const lightsail = NetworkProviders.Lightsail.MainNet();
```

### Account Management

```ts
import { LocalSigner, NativeAccount } from "@colibri/core";

const signer = LocalSigner.fromSecret("S...");
const account = NativeAccount.fromMasterSigner(signer);
```

### Transaction Pipelines

```ts
import {
  createInvokeContractPipeline,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { Operation } from "stellar-sdk";

const network = NetworkConfig.TestNet();
const signer = LocalSigner.fromSecret("S...");

const pipeline = createInvokeContractPipeline({ networkConfig: network });

const result = await pipeline.run({
  operations: [
    Operation.invokeContractFunction({
      contract: "CABC...",
      function: "transfer",
      args: [],
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

### High-Level Clients

```ts
import { Contract, NetworkConfig, StellarAssetContract } from "@colibri/core";

const network = NetworkConfig.TestNet();

const contract = new Contract({
  networkConfig: network,
  contractConfig: { contractId: "CABC..." },
});

const sac = StellarAssetContract.fromContractId({
  networkConfig: network,
  contractId: "CBI...",
});
```

### Event Parsing

```ts
import { EventFilter, EventType, SACEvents } from "@colibri/core";

const filter = new EventFilter({
  contractIds: ["C..."],
  type: EventType.Contract,
  topics: [SACEvents.TransferEvent.toTopicFilter()],
});

const transfer = SACEvents.TransferEvent.fromEvent(rawEvent);
console.log(transfer.from, transfer.to, transfer.amount);
```

## Type Exports

`@colibri/core` exports both runtime values and type-only symbols:

```ts
import {
  Contract,
  EventFilter,
  LocalSigner,
  NetworkConfig,
  SACEvents,
  createInvokeContractPipeline,
  steps,
} from "@colibri/core";

import type {
  ContractId,
  Ed25519PublicKey,
  MemoizePolicy,
  Signer,
  TransactionConfig,
} from "@colibri/core";
```

## Error Handling

```ts
import { ColibriError } from "@colibri/core";

try {
  await contract.invoke({ method, methodArgs, config });
} catch (error) {
  if (error instanceof ColibriError) {
    console.log(error.code);
    console.log(error.source);
    console.log(error.details);
  }
}
```

## Choosing A Layer

- use high-level clients when you want ergonomics and a stable object-oriented
  interface
- use `create*Pipeline(...)` when you want to attach plugins or own the flow
- use `steps` when you need stable orchestration ids
- use raw processes when you want isolated single-purpose behavior

## Next Steps

- [Contract](contract.md) — High-level Soroban client
- [Stellar Asset Contract](asset/stellar-asset-contract.md) — SAC-specific
  client
- [Pipelines](pipelines/README.md) — Built-in write and read flows
- [Error Handling](error.md) — Typed error model
