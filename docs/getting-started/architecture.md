# Architecture Overview

Colibri separates **business logic**, **orchestration**, and **optional
extensions** so each layer stays composable.

## Layers

### Processes

Processes are plain functions such as `buildTransaction`, `simulateTransaction`,
`signEnvelope`, and `sendTransaction`.

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

```text
Build → Recording Simulation → Sign Auth Entries
  → Assemble For Enforcement → Enforce Simulation
  → Final Assembly → Resolve Envelope Requirements → Sign Envelope → Submit
```

The enforcement assembly and simulation stages inspect the authorization entry
XDR. They pass ordinary transactions through without a second RPC simulation and
activate only when delegated credentials require CAP-71 enforcement.

Colibri ships factory functions for the common flows:

- `createInvokeContractPipeline(...)`
- `createReadFromContractPipeline(...)`
- `createClassicTransactionPipeline(...)`

Each one also exports a stable `*_PIPELINE_ID` constant.

### Plugins

Plugins target explicit step or pipeline IDs. Fee sponsorship is step-level;
channel-account allocation is pipeline-level. The following fragment assumes you
have configured a sponsor signer; the
[complete sponsored payment](../packages/plugins/channel-accounts/example.md)
also shows funding and cleanup.

```ts
import { createInvokeContractPipeline, NetworkConfig } from "@colibri/core";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";

const networkConfig = NetworkConfig.TestNet();
const invokeWithSponsor = createInvokeContractPipeline({ networkConfig });

invokeWithSponsor.use(
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

Core-owned failures use typed errors with stable codes and sources. Network,
application callback, and plugin errors may still propagate as unknown values;
RPC Streamer has its own error base. Keep an unknown-error branch:

```ts
import { ColibriError } from "@colibri/core";

try {
  await invokeWithSponsor({ operations, config });
} catch (error) {
  if (ColibriError.is(error)) {
    console.log(error.code);
    console.log(error.source);
    console.log(error.details);
  } else {
    throw error;
  }
}
```

## Next Steps

- [Pipelines](../core/pipelines/README.md) — Built-in orchestration flows
- [Steps](../core/steps.md) — Stable ids and plugin targets
- [Processes](../core/processes/README.md) — Raw building blocks
- [Plugins](../packages/plugins/README.md) — Optional pipeline extensions
