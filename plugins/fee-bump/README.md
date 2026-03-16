# FeeBump Plugin

A Colibri plugin that wraps a Stellar Transaction in a Fee Bump Transaction so a designated account pays the fees.

It targets the `SendTransaction` step from `@colibri/core`. You can attach it to any `convee` pipe that includes `steps.SEND_TRANSACTION_STEP_ID` (for example, `PIPE_InvokeContract`).

[📚 Documentation](https://colibri-docs.gitbook.io/) | [💡 Examples](https://github.com/fazzatti/colibri-examples)

## Quick start

Choose the integration style you need.

### Using with a pipeline

Minimal usage — create the plugin with its configuration and add it to a pipeline that targets the `SendTransaction` step:

```ts
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";
import { PIPE_InvokeContract, NetworkConfig } from "@colibri/core";

const networkConfig = NetworkConfig.TestNet();

const plugin = PLG_FeeBump.create({
  networkConfig,
  feeBumpConfig: {
    source: "G...FEEPAYER", // fee payer address
    fee: "10000000", // fee in stroops (1 XLM)
    signers: [
      /* signer objects */
    ],
  },
});

const pipeline = PIPE_InvokeContract.create({ networkConfig });
pipeline.use(plugin);
```

See the tests for full examples.

## How it works

The plugin runs on the input of the `SendTransaction` step. It inspects the incoming payload, wraps and authorizes the `transaction` with a `FeeBumpTransaction` signed by the configured signers, and returns the modified input for the rest of the pipeline.

## API

- `PLG_FeeBump.create(options)` — create plugin instance
- `PLG_FeeBump.name` — plugin name
- `PLG_FeeBump.target` — pipeline step where it should be added (`SendTransaction`)

For concrete examples, refer to the unit and integration tests in `src/`.

## Options

`PLG_FeeBump.create` accepts an options object with the following fields:

- `networkConfig` (required) — Colibri network configuration (for example, `NetworkConfig.TestNet()`). The plugin uses this configuration when building transactions.

- `feeBumpConfig` (required) — Configuration for the fee bump behavior:
  - `source` (string, required) — The Stellar account address that will pay the fee (fee source).
  - `fee` (string, required) — Fee amount in stroops to set on the FeeBumpTransaction as base fee\* (e.g. `"10000000"` equals 1 XLM).
  - `signers` (array, optional) — Array of signer objects (e.g., `NativeAccount.signer()` or `LocalSigner`) used to authorize the fee bump transaction.

_\*Since this value defines a base fee, the total amount set as max network fee will be this value multiplied by the number of operations in the inner envelope plus one(the fee bump wrap). So, for contract invocations for example this will be 2 times the value set as it only contains one operation plus the wrapper._

`Example:`

```ts
PLG_FeeBump.create({
  networkConfig: NetworkConfig.TestNet(),
  feeBumpConfig: {
    source: feePayer.address(),
    fee: "10000000",
    signers: [feePayer.signer()],
  },
});
```
