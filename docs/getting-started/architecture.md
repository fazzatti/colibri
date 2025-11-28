# Architecture Overview

Colibri is built around three core principles: **typed error handling**, **composable pipelines**, and **type-safe abstractions**.

## Error Handling Philosophy

Colibri uses **typed errors** that extend the `ColibriError` class. Every error has:

- A unique error code (e.g., `BTX_003`, `SIM_001`)
- A human-readable message
- Optional diagnostic information with suggestions

```typescript
import { ColibriError, PIPE_InvokeContract, NetworkConfig } from "@colibri/core";

const pipeline = PIPE_InvokeContract.create({ networkConfig: NetworkConfig.TestNet() });

try {
  const result = await pipeline.run({...});
  console.log("Success:", result.hash);
} catch (error) {
  if (ColibriError.is(error)) {
    console.log("Error Code:", error.code);
    console.log("Message:", error.message);

    if (error.diagnostic) {
      console.log("Suggestion:", error.diagnostic.suggestion);
    }
  }
}
```

### Why Typed Errors?

1. **Predictable** — Each module defines its possible errors with unique codes
2. **Type-Safe** — Use `ColibriError.is()` for type narrowing
3. **Diagnostic** — Errors include suggestions and reference materials
4. **Chainable** — Errors preserve their causal chain via `meta.cause`

### The `assert` Function

Internally, Colibri uses `assert` to validate conditions and create typed errors:

```typescript
import { assert } from "@colibri/core";

// Throws a ColibriError if condition is false
assert(publicKey.startsWith("G"), new INVALID_PUBLIC_KEY(publicKey));
```

### Error Types

Every error in Colibri extends `ColibriError`:

```typescript
class ColibriError extends Error {
  code: string; // Unique identifier like "BTX_003"
  message: string; // Human-readable description
  details: string; // Additional context
  source: string; // Module that threw the error
  cause?: Error; // Original error if wrapped
}
```

## Pipeline Architecture

Colibri uses the [`convee`](https://jsr.io/@prglab/convee) library to compose transaction workflows as **pipelines** of discrete **processes**.

### What is a Pipeline?

A pipeline chains multiple processes together, where each process:

- Receives input from the previous process
- Performs a specific task (build, simulate, sign, submit)
- Passes output to the next process

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐    ┌────────┐
│  Build  │ → │ Simulate │ → │ SignAuth │ → │  Sign  │ → │ Submit │
└─────────┘    └──────────┘    └──────────┘    └────────┘    └────────┘
```

### Built-in Pipelines

Colibri provides three ready-to-use pipelines:

| Pipeline                  | Description                                             |
| ------------------------- | ------------------------------------------------------- |
| `PIPE_InvokeContract`     | Build, simulate, sign, and submit a contract invocation |
| `PIPE_ReadFromContract`   | Build and simulate a read-only contract call            |
| `PIPE_ClassicTransaction` | Build, sign, and submit a classic Stellar transaction   |

### Building Custom Pipelines

You can compose your own pipelines using individual processes:

```typescript
import { Pipeline } from "convee";
import {
  P_BuildTransaction,
  P_SimulateTransaction,
  P_SignEnvelope,
  P_SendTransaction,
} from "@colibri/core";

// Each process is a factory function
const BuildTransaction = P_BuildTransaction();
const SimulateTransaction = P_SimulateTransaction();
const SignEnvelope = P_SignEnvelope();
const SendTransaction = P_SendTransaction();

// Compose into a pipeline
const pipe = Pipeline.create([
  BuildTransaction,
  SimulateTransaction,
  SignEnvelope,
  SendTransaction,
]);
```

## Processes

Processes are the atomic units of work in Colibri. Each process:

- Has typed input and output
- Returns a `Result` type
- Can be used standalone or in pipelines

### Available Processes

| Process                 | Input              | Output               | Description                          |
| ----------------------- | ------------------ | -------------------- | ------------------------------------ |
| `P_BuildTransaction`    | Transaction params | Unsigned transaction | Builds a transaction from operations |
| `P_SimulateTransaction` | Unsigned TX        | Simulation result    | Simulates on RPC                     |
| `P_SignAuthEntries`     | Simulation result  | Authorized TX        | Signs Soroban auth entries           |
| `P_AssembleTransaction` | Simulation result  | Assembled TX         | Adds simulation results to TX        |
| `P_SignEnvelope`        | Assembled TX       | Signed TX            | Signs the transaction envelope       |
| `P_SendTransaction`     | Signed TX          | TX result            | Submits to network and waits         |
| `P_WrapFeeBump`         | Inner TX           | Fee bump TX          | Wraps TX with fee bump               |

## Plugins

Plugins extend pipeline behavior by wrapping processes. The most common use case is fee bumping:

```typescript
import { PIPE_InvokeContract, NetworkConfig, LocalSigner } from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";

const network = NetworkConfig.TestNet();
const pipeline = PIPE_InvokeContract.create({ networkConfig: network });

// Create and add a fee bump plugin
const feeBumpPlugin = PLG_FeeBump.create({
  networkConfig: network,
  feeBumpConfig: {
    source: sponsorPublicKey,
    fee: "1000000", // 0.1 XLM in stroops
    signers: [sponsorSigner],
  },
});

pipeline.addPlugin(feeBumpPlugin, PLG_FeeBump.target);

const result = await pipeline.run({
  operations: [...],
  config: {...},
});
```

## Type System

Colibri leverages TypeScript's type system extensively:

### Branded Types

String types like public keys and contract IDs are **branded** to prevent mixing them up:

```typescript
type Ed25519PublicKey = string & { __brand: "Ed25519PublicKey" };
type ContractId = string & { __brand: "ContractId" };

// These won't compile:
const pk: Ed25519PublicKey = "not-validated"; // Error!
invokeContract({ contractId: publicKey }); // Error!
```

### Validation Guards

Use `StrKey` to validate and narrow types:

```typescript
import { StrKey } from "@colibri/core";

const input = "G...";

if (StrKey.isEd25519PublicKey(input)) {
  // TypeScript now knows input is Ed25519PublicKey
  await loadAccount(input);
}
```

## Next Steps

- [Error Handling](../core/error.md) — Deep dive into the error system
- [Processes](../core/processes/README.md) — Learn about each process in detail
- [Pipelines](../core/pipelines/README.md) — Build custom transaction workflows
