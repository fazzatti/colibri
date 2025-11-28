# Pipelines

Pipelines chain multiple [processes](../processes/README.md) and transformer functions into reusable workflows. Built on the [`convee`](https://jsr.io/@fifo/convee) library, they handle the complexity of multi-step transaction flows.

In Colibri, all pipelines are prefixed with `PIPE_` (e.g., `PIPE_InvokeContract`).

A pipeline connects steps sequentially—each step receives the output of the previous one. Steps can be:

- **Processes** — Atomic operations like `BuildTransaction`, `SimulateTransaction`
- **Transformers** — Simple functions that modify or reshape data between processes

Like processes, pipelines can be extended with plugins that operate on the input, output, or errors at specific points in the flow.

## Plugins

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

See [Plugins](../../packages/plugins.md) for available plugins.
