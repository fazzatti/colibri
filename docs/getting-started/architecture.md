# Architecture Overview

Colibri separates execution from orchestration so the core logic stays easy to test and the higher-level flows stay easy to extend.

## Layers

### Processes

Processes are plain functions such as `buildTransaction`, `simulateTransaction`, `signEnvelope`, and `sendTransaction`.

- They do one job
- They expose typed inputs and outputs
- They raise named `ColibriError` subclasses
- They do not depend on `convee`

Use processes directly when you need a single operation in isolation or when you want to build your own orchestration.

### Steps

Steps are thin [`convee`](https://jsr.io/@fifo/convee) wrappers around processes.

- They assign stable ids such as `steps.SEND_TRANSACTION_STEP_ID`
- They define plugin targets
- They keep orchestration concerns out of the process layer

### Connectors

Connectors adapt one step boundary into the next.

- Pipeline-specific connectors live next to the owning pipeline
- Shared connectors live under `core/pipelines/shared/connectors`
- They use run context instead of the older metadata helper pattern

### Pipelines

Pipelines are ready-to-use `convee` pipes built from step wrappers and connectors.

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐     ┌────────┐
│  Build  │ ──→ │ Simulate │ ──→ │ SignAuth │ ──→ │  Sign  │ ──→ │ Submit │
└─────────┘     └──────────┘     └──────────┘     └────────┘     └────────┘
```

Colibri ships with:

- `PIPE_InvokeContract`
- `PIPE_ReadFromContract`
- `PIPE_ClassicTransaction`

See [Pipelines](../core/pipelines/) for details.

### Plugins

Plugins attach to step ids inside a pipeline. For example, the Fee Bump plugin targets the `SendTransaction` step and wraps the outgoing transaction before submission.

```typescript
import { PIPE_InvokeContract, NetworkConfig } from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";

const networkConfig = NetworkConfig.TestNet();
const pipeline = PIPE_InvokeContract.create({ networkConfig });

pipeline.use(
  PLG_FeeBump.create({
    networkConfig,
    feeBumpConfig: {
      source: "G...SPONSOR",
      fee: "1000000",
      signers: [sponsorSigner],
    },
  }),
);
```

See [Plugins](../packages/plugins/) for available plugins and usage.

## Domain Modules

Colibri also keeps reusable domain logic outside the orchestration layer:

- `address` for address normalization helpers such as muxed-account handling
- `auth` for authorization and threshold rules
- `signer` for signer interfaces and implementations
- `network` for validated network configuration

## Type Safety

Colibri uses TypeScript narrowing and validation helpers throughout the stack:

```typescript
import { StrKey } from "@colibri/core";

const input = "G...";

if (StrKey.isEd25519PublicKey(input)) {
  await loadAccount(input);
}
```

## Error Handling

Every Colibri subsystem emits typed errors with stable codes and structured metadata:

```typescript
import { ColibriError } from "@colibri/core";

try {
  const result = await pipeline.run({...});
} catch (error) {
  if (ColibriError.is(error)) {
    console.log("Error Code:", error.code);
    console.log("Message:", error.message);
    console.log("Source:", error.source);
  }
}
```

See [Error Handling](../core/error.md) for the full model.

## Next Steps

- [Pipelines](../core/pipelines/) — Build transaction workflows
- [Steps](../core/steps.md) — Understand the orchestration wrappers and plugin targets
- [Processes](../core/processes/) — Learn about the raw building blocks
- [Plugins](../packages/plugins/) — Extend behavior with step-targeted plugins
- [Error Handling](../core/error.md) — Deep dive into the error system
