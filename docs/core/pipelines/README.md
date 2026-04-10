# Pipelines

Pipelines combine [processes](../processes/README.md), step wrappers, and
connectors into reusable transaction workflows. They are built on
[`convee`](https://jsr.io/@fifo/convee).

Colibri exposes factory functions instead of wrapper objects:

- `createInvokeContractPipeline(...)`
- `createReadFromContractPipeline(...)`
- `createClassicTransactionPipeline(...)`

Each pipeline also exports a stable `*_PIPELINE_ID` constant.

## Common Structure

Each built-in pipeline typically includes:

- input connectors that normalize the public input shape
- step wrappers around raw processes such as `buildTransaction` and
  `sendTransaction`
- shared connectors from `core/pipelines/shared/connectors`
- pipeline-specific connectors beside the owning pipeline

## Plugins

Plugins target a specific step id and are attached with `pipeline.use(...)`:

```ts
import { createInvokeContractPipeline, NetworkConfig } from "@colibri/core";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";

const networkConfig = NetworkConfig.TestNet();
const pipeline = createInvokeContractPipeline({ networkConfig });

pipeline.use(
  createFeeBumpPlugin({
    networkConfig,
    feeBumpConfig: {
      source: sponsorAddress,
      fee: "10000000",
      signers: [sponsorSigner],
    },
  }),
);
```

For available plugins, see [Plugins](../../packages/plugins/README.md).
