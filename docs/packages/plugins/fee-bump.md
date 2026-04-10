# @colibri/plugin-fee-bump

`@colibri/plugin-fee-bump` lets a separate account cover the network fees for a
transaction by wrapping the outgoing envelope in a fee-bump transaction.

It targets the `SendTransaction` step, so it can be attached to any pipeline
that includes `steps.SEND_TRANSACTION_STEP_ID`.

## Installation

```bash
deno add jsr:@colibri/plugin-fee-bump
```

## Quick Start

```ts
import {
  createInvokeContractPipeline,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";
import { Operation } from "stellar-sdk";

const userSigner = LocalSigner.fromSecret("USER_SECRET...");
const sponsorSigner = LocalSigner.fromSecret("SPONSOR_SECRET...");
const network = NetworkConfig.TestNet();

const pipeline = createInvokeContractPipeline({ networkConfig: network });

pipeline.use(
  createFeeBumpPlugin({
    networkConfig: network,
    feeBumpConfig: {
      source: sponsorSigner.publicKey(),
      fee: "1000000",
      signers: [sponsorSigner],
    },
  }),
);

const result = await pipeline.run({
  operations: [
    Operation.invokeContractFunction({
      contract: "CABC...",
      function: "transfer",
      args: [],
    }),
  ],
  config: {
    source: userSigner.publicKey(),
    fee: "100000",
    timeout: 30,
    signers: [userSigner],
  },
});
```

## Public API

- `createFeeBumpPlugin(...)`
- `FEE_BUMP_PLUGIN_ID`
- `FEE_BUMP_PLUGIN_TARGET`

## Configuration

`createFeeBumpPlugin(...)` accepts:

| Property                | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `networkConfig`         | Network configuration used to build the wrapper  |
| `feeBumpConfig.source`  | Stellar address that will pay the fee bump       |
| `feeBumpConfig.fee`     | Base fee in stroops for the outer envelope       |
| `feeBumpConfig.signers` | Signers that authorize the fee-bump envelope     |

## How It Works

1. The pipeline reaches the `SendTransaction` step
2. The plugin intercepts the step input
3. It wraps the outgoing transaction in a fee-bump envelope
4. It signs that outer envelope with the configured sponsor signers
5. The wrapped transaction continues to `sendTransaction`

The inner transaction signatures are preserved.

## Error Codes

| Code          | Class               | Description                    |
| ------------- | ------------------- | ------------------------------ |
| `PLG_FBP_000` | `UNEXPECTED_ERROR`  | Unexpected plugin failure      |
| `PLG_FBP_001` | `MISSING_ARG`       | Required configuration missing |
| `PLG_FBP_002` | `NOT_A_TRANSACTION` | Intercepted payload invalid    |

## Related Docs

- [Pipelines](../../core/pipelines/README.md)
- [WrapFeeBump](../../core/processes/wrap-fee-bump.md)
- [Signer](../../core/signer/README.md)
