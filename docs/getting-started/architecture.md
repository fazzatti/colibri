# Architecture Overview

Colibri is built around core principles: **composable pipelines**, **robust processes**, **extensible plugins**, and **type-safe abstractions**.

## Pipeline Architecture

Colibri uses the [`convee`](https://jsr.io/@fifo/convee) library to compose workflows as **pipelines** of discrete **processes**.

### What is a Pipeline?

A pipeline chains multiple processes together, where each process:

- Receives input from the previous process
- Performs a specific task (build, simulate, sign, submit)
- Passes output to the next process

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐     ┌────────┐
│  Build  │ ──→ │ Simulate │ ──→ │ SignAuth │ ──→ │  Sign  │ ──→ │ Submit │
└─────────┘     └──────────┘     └──────────┘     └────────┘     └────────┘
```

Colibri provides ready-to-use pipelines for common use cases like contract invocation, read-only calls, and classic transactions. You can use them directly or compose custom pipelines from individual processes.

See [Pipelines](../core/pipelines/README.md) for the full list and detailed documentation.

## Processes

Processes are the atomic building blocks of Colibri. Each process handles a single task with predictable behavior, typed input/output, and specific error codes. They can be used standalone or composed into pipelines.

See [Processes](../core/processes/README.md) for the full list and detailed documentation.

## Plugins

Plugins extend pipeline and process behavior without modifying core logic. They wrap around steps to add functionality like fee sponsorship, custom signing strategies, or logging.

See [Plugins](../packages/plugins.md) for available plugins and how to use them.

## Type Safety

Colibri leverages TypeScript's type system extensively to ensure consistency across all components. Validation guards like `StrKey` help validate and narrow types at runtime:

```typescript
import { StrKey } from "@colibri/core";

const input = "G...";

if (StrKey.isEd25519PublicKey(input)) {
  // TypeScript now knows input is Ed25519PublicKey
  await loadAccount(input);
}
```

Type checkers are available for public keys, secret keys, contract IDs, muxed addresses, and more—keeping consistency across the core components and tools.

## Core Types

Colibri uses well-defined interfaces and types throughout, so you can build custom implementations that integrate seamlessly with all tools. Key examples:

- **[TransactionSigner](../core/signer/README.md)** — Any signer implementing this interface works with all pipelines
- **[TransactionConfig](../core/transaction-config.md)** — Standard transaction parameters (fee, source, timeout, signers)
- **[NetworkConfig](../core/network.md)** — Network connection settings

This pattern means you're never locked into Colibri's built-in implementations. Build your own signers, use your own key management, and everything integrates cleanly.

## Error Handling

Colibri uses **typed errors** with unique, standardized error codes across the entire library. Every error includes:

- A unique error code (e.g., `BTX_003`, `SIM_001`)
- A human-readable message
- Optional diagnostic information with suggestions

Network failures and external errors are wrapped and enriched with context, making debugging straightforward.

```typescript
import { ColibriError } from "@colibri/core";

try {
  const result = await pipeline.run({...});
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

See [Error Handling](../core/error.md) for the full error system documentation.

## Next Steps

- [Pipelines](../core/pipelines/README.md) — Build custom transaction workflows
- [Processes](../core/processes/README.md) — Learn about each process in detail
- [Plugins](../packages/plugins.md) — Extend behavior with plugins
- [Error Handling](../core/error.md) — Deep dive into the error system
