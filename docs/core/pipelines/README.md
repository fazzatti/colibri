# Pipelines

Pipelines combine [processes](../processes/README.md), step wrappers, and
connectors into reusable transaction workflows. They are built on
[`convee`](https://jsr.io/@fifo/convee).

Colibri exposes factory functions instead of wrapper objects:

- `createInvokeContractPipeline(...)`
- `createReadFromContractPipeline(...)`
- `createClassicTransactionPipeline(...)`

Each pipeline also exports a stable `*_PIPELINE_ID` constant.

The returned pipeline is callable. Name it after the action and invoke it
directly:

```ts
const invokeContract = createInvokeContractPipeline({ networkConfig });
const result = await invokeContract({ operations, config });
```

The callable also exposes methods such as `use(...)` for composition. Calling
`.run(...)` is unnecessary in application code.

## Common Structure

Each built-in pipeline typically includes:

- input connectors that normalize the public input shape
- step wrappers around raw processes such as `buildTransaction` and
  `sendTransaction`
- shared connectors from `core/pipelines/shared/connectors`
- pipeline-specific connectors beside the owning pipeline

## Plugins

Plugins target a specific step or pipeline ID and are attached with the callable
pipeline's `use(...)` method. This fragment uses an application-provided
sponsor:

```ts
import { createInvokeContractPipeline, NetworkConfig } from "@colibri/core";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";

const networkConfig = NetworkConfig.TestNet();
const invokeWithSponsor = createInvokeContractPipeline({ networkConfig });

invokeWithSponsor.use(
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
