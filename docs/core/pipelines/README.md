# Pipelines

Pipelines combine [processes](../processes/README.md), step wrappers, and
connectors into reusable transaction workflows. They are built on
[`convee` 2](https://jsr.io/@fifo/convee/2.0.0).

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

## Convee 2.1 compatibility

Use Convee 2.1 when composing custom pipes or plugins with this release.
Colibri's factory names, callable inputs, step IDs, transaction fees, and
signing order remain unchanged. `use(...)` and `remove(...)` return the same
callable instance.

Custom integrations should review the
[Convee 1.x migration guide](https://github.com/fazzatti/convee/tree/v2.1.0#migrating-from-1x),
particularly these upstream rules:

- An array returned by a child is spread into the next child's arguments. To
  pass one array argument, return an outer one-element tuple, `[array]`.
- Error hooks handle failures from the step or pipeline body. Failures in that
  unit's input/output hooks propagate; they do not enter its own error hooks. Do
  not rely on an error hook as an unconditional cleanup/finally handler.
- Use `onFinally` for resource cleanup after execution settles. Finalizers run
  even when input, output, or error hooks fail, and async cleanup is awaited. A
  finalizer must tolerate an input hook that never acquired its resource. The
  channel-accounts plugin uses this lifecycle to return pooled channels.
- Context views belong to individual invocations. Share state through a parent
  run context, and keep output capture enabled when using Colibri connectors
  that read preceding step outputs.
- Distinct children must not reuse a step ID within a pipe. Update plugins
  through `use`/`remove`, not by mutating the returned plugin or child lists.

Colibri keeps the original callable binding in its built-in clients; custom
consumers may also use Convee 2's callable chaining.
