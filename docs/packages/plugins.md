# Plugins

Plugins extend the behavior of pipelines and processes without modifying their core logic. They allow you to inject custom functionality at specific steps in transaction workflows.

## How Plugins Work

Plugins wrap around pipeline steps or processes, intercepting input and output to add custom behavior:

```
Input → [Plugin: Pre-process] → Process → [Plugin: Post-process] → Output
```

This architecture enables:

- **Fee Sponsorship** — Wrap transactions with fee bumps
- **Custom Signing** — Integrate hardware wallets or custodial signers
- **Logging & Metrics** — Track transaction lifecycle events
- **Validation** — Add custom checks before submission

## Available Plugins

| Plugin                         | Description                           |
| ------------------------------ | ------------------------------------- |
| [Fee Bump](plugin-fee-bump.md) | Wrap transactions for fee sponsorship |

## Using Plugins

Plugins are added to pipelines or processes using the `addPlugin` method:

```typescript
import { PIPE_InvokeContract, NetworkConfig } from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";

const pipeline = PIPE_InvokeContract.create({ networkConfig });

const plugin = PLG_FeeBump.create({
  networkConfig,
  feeBumpConfig: {
    source: sponsorPublicKey,
    fee: "1000000",
    signers: [sponsorSigner],
  },
});

pipeline.addPlugin(plugin, PLG_FeeBump.target);
```

## Creating Custom Plugins

Plugins are built using the `convee` library's Plugin API:

```typescript
import { Plugin } from "convee";

const myPlugin = Plugin.create({
  name: "MyCustomPlugin",
  processInput: async (input) => {
    // Modify input before the process runs
    return input;
  },
  processOutput: async (output) => {
    // Modify output after the process completes
    return output;
  },
});
```
