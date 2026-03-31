# Architecture Overview

Colibri separates **business logic**, **orchestration**, and **optional
extensions** so each layer stays composable.

## Layers

### Processes

Processes are plain functions such as `buildTransaction`,
`simulateTransaction`, `signEnvelope`, and `sendTransaction`.

- one job each
- typed input/output
- stable error codes
- no `convee` dependency

Use them directly when you want isolated behavior or your own orchestration.

### Steps

Steps are thin [`convee`](https://jsr.io/@fifo/convee) wrappers around
processes.

- expose stable ids such as `steps.SEND_TRANSACTION_STEP_ID`
- define plugin targets
- keep orchestration concerns out of the process layer

### Connectors

Connectors adapt one step boundary into the next.

- pipeline-specific connectors live next to the owning pipeline
- shared connectors live under `core/pipelines/shared/connectors`
- they use run context to pass step output across the flow

### Pipelines

Pipelines are ready-to-use `convee` pipes built from steps and connectors.

```
┌─────────┐ → ┌──────────┐ → ┌──────────┐ → ┌────────┐ → ┌────────┐
│  Build  │   │ Simulate │   │ SignAuth │   │  Sign  │   │ Submit │
└─────────┘   └──────────┘   └──────────┘   └────────┘   └────────┘
```

Colibri ships factory functions for the common flows:

- `createInvokeContractPipeline(...)`
- `createReadFromContractPipeline(...)`
- `createClassicTransactionPipeline(...)`

Each one also exports a stable `*_PIPELINE_ID` constant.

### Plugins

Plugins attach to step ids inside a pipeline.

```ts
import { createInvokeContractPipeline, NetworkConfig } from "@colibri/core";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";

const networkConfig = NetworkConfig.TestNet();
const pipeline = createInvokeContractPipeline({ networkConfig });

pipeline.use(
  createFeeBumpPlugin({
    networkConfig,
    feeBumpConfig: {
      source: "G...SPONSOR",
      fee: "1000000",
      signers: [sponsorSigner],
    },
  }),
);
```

High-level clients keep plugins in the pipeline layer instead of inventing a
second abstraction:

```ts
contract.invokePipe.use(plugin);
sac.contract.invokePipe.use(plugin);
```

## Domain Modules

Outside the orchestration layer, Colibri also exposes reusable domain logic:

- `address` for normalization and muxed-account handling
- `auth` for authorization and threshold rules
- `network` for validated network configuration
- `signer` for shared signer contracts and implementations

## Type Safety

Colibri leans on branded types, runtime validators, and narrow structural types
at public boundaries:

```ts
import { StrKey } from "@colibri/core";

const input = "G...";

if (StrKey.isEd25519PublicKey(input)) {
  await loadAccount(input);
}
```

## Error Handling

Every subsystem emits typed errors with stable codes and sources:

```ts
import { ColibriError } from "@colibri/core";

try {
  await pipeline.run({ operations, config });
} catch (error) {
  if (ColibriError.is(error)) {
    console.log(error.code);
    console.log(error.source);
    console.log(error.details);
  }
}
```

## Next Steps

- [Pipelines](../core/pipelines/README.md) — Built-in orchestration flows
- [Steps](../core/steps.md) — Stable ids and plugin targets
- [Processes](../core/processes/README.md) — Raw building blocks
- [Plugins](../packages/plugins/README.md) — Optional pipeline extensions
