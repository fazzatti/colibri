# Pipelines

Pipelines are pre-composed workflows that chain multiple [processes](../processes/README.md) together for common transaction patterns. They're built on the [`convee`](https://jsr.io/@fifo/convee) library.

## Available Pipelines

### Invoke Contract

Full contract invocation: build → simulate → sign auth → assemble → sign envelope → submit.

```
BuildTransaction → SimulateTransaction → SignAuthEntries → AssembleTransaction
    → EnvelopeSigningRequirements → SignEnvelope → SendTransaction
```

[Full documentation →](invoke-contract.md)

### Read From Contract

Read-only contract calls: build → simulate → extract return value.

```
BuildTransaction → SimulateTransaction → (extract retval)
```

[Full documentation →](read-from-contract.md)

### Classic Transaction

Classic Stellar operations: build → determine signing requirements → sign → submit.

```
BuildTransaction → EnvelopeSigningRequirements → SignEnvelope → SendTransaction
```

[Full documentation →](classic-transaction.md)

## Plugins

Pipelines can be extended with plugins. Each plugin targets specific processes within the pipeline:

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
