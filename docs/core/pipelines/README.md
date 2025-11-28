# Pipelines

Pipelines are pre-composed workflows that chain multiple processes together for common transaction patterns. They're built on top of the `convee` process engine.

## Available Pipelines

| Pipeline                                      | Use Case                                         |
| --------------------------------------------- | ------------------------------------------------ |
| [Invoke Contract](invoke-contract.md)         | Build, simulate, sign, and submit contract calls |
| [Read From Contract](read-from-contract.md)   | Simulate read-only contract calls                |
| [Classic Transaction](classic-transaction.md) | Build, sign, and submit classic operations       |

## Architecture

Pipelines are built using the `convee` library and consist of:

1. **Processes** — Atomic operations (build, simulate, sign, send)
2. **Connectors** — Transform data between processes
3. **Metadata Storage** — Store intermediate results

## Adding Plugins

```typescript
import { PIPE_InvokeContract } from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";

const pipeline = PIPE_InvokeContract.create({ networkConfig });

const feeBumpPlugin = PLG_FeeBump.create({
  networkConfig,
  feeBumpConfig: {
    source: sponsorAddress,
    fee: "10000000",
    signers: [sponsorSigner],
  },
});

pipeline.addPlugin(feeBumpPlugin, PLG_FeeBump.target);
```
