# Pipelines

Pipelines combine [processes](../processes/) with step wrappers and connectors into reusable workflows. They are built on [`convee`](https://jsr.io/@fifo/convee) and expose `PIPE_*` factories such as `PIPE_InvokeContract`.

Each pipeline typically includes:

- **Input connectors** that normalize pipeline input into a process-friendly shape
- **Step wrappers** around raw processes such as `buildTransaction` and `sendTransaction`
- **Shared connectors** under `core/pipelines/shared/connectors`
- **Pipeline-specific connectors** kept next to the owning pipeline

## Plugins

Plugins target a specific step id and are attached with `pipeline.use(...)`:

```typescript
import { PIPE_InvokeContract, NetworkConfig } from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";

const networkConfig = NetworkConfig.TestNet();
const pipeline = PIPE_InvokeContract.create({ networkConfig });

const feeBumpPlugin = PLG_FeeBump.create({
  networkConfig,
  feeBumpConfig: {
    source: sponsorAddress,
    fee: "10000000",
    signers: [sponsorSigner],
  },
});

pipeline.use(feeBumpPlugin);
```

See [Plugins](../../packages/plugins/) for available plugins.
