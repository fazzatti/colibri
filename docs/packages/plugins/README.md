# Plugins

Plugins extend pipeline step behavior without modifying the core flow. They are
attached with `pipeline.use(...)` and target stable step ids or pipeline ids.

## Why Plugins?

Plugins are useful when you want to add behavior such as:

- fee sponsorship
- channel-account source swapping
- logging or metrics around a specific step
- custom validation before submission

## Available Plugins

| Plugin                                  | Description                                                   |
| --------------------------------------- | ------------------------------------------------------------- |
| [Fee Bump](fee-bump.md)                 | Wrap outgoing transactions in a fee-bump envelope             |
| [Channel Accounts](channel-accounts.md) | Reuse sponsored channel accounts across classic/invoke writes |

## Using A Plugin

```ts
import { createInvokeContractPipeline, NetworkConfig } from "@colibri/core";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";

const networkConfig = NetworkConfig.TestNet();
const pipeline = createInvokeContractPipeline({ networkConfig });

pipeline.use(
  createFeeBumpPlugin({
    networkConfig,
    feeBumpConfig: {
      source: feeSourcePublicKey,
      fee: "1000000",
      signers: [feeSourceSigner],
    },
  }),
);
```

## Creating Custom Plugins

Custom plugins are built with `convee` and target stable step ids from
`@colibri/core`:

```ts
import { plugin } from "convee";
import { steps } from "@colibri/core";

const myPlugin = plugin({
  id: "my-plugin",
  target: steps.SEND_TRANSACTION_STEP_ID,
}).onInput(async (input) => {
  return input;
});
```
