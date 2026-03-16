# Plugins

Plugins extend pipeline step behavior without modifying core logic. They let you inject custom functionality at specific orchestration points in a transaction flow.

## How Plugins Work

Plugins target a step id and wrap that step's lifecycle:

```
Pipe input → Step connector → [Plugin target step] → Step output
```

This architecture enables:

- **Fee Coverage** — Wrap transactions with fee bumps so a separate account covers network fees
- **Custom Signing** — Integrate hardware wallets or custodial signers
- **Logging & Metrics** — Track transaction lifecycle events
- **Validation** — Add custom checks before submission

## Available Plugins

| Plugin                  | Description                                      |
| ----------------------- | ------------------------------------------------ |
| [Fee Bump](fee-bump.md) | Wrap transactions so another account covers fees |

## Using Plugins

Plugins are attached to a pipeline with `use(...)`:

```typescript
import { PIPE_InvokeContract, NetworkConfig } from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";

const networkConfig = NetworkConfig.TestNet();
const pipeline = PIPE_InvokeContract.create({ networkConfig });

const plugin = PLG_FeeBump.create({
  networkConfig,
  feeBumpConfig: {
    source: feeSourcePublicKey,
    fee: "1000000",
    signers: [feeSourceSigner],
  },
});

pipeline.use(plugin);
```

## Creating Custom Plugins

Custom plugins are built with `convee` and target stable step ids exported by `@colibri/core`:

```typescript
import { plugin } from "convee";
import { steps } from "@colibri/core";

const myPlugin = plugin({
  id: "my-plugin",
  target: steps.SEND_TRANSACTION_STEP_ID,
}).onInput(async (input) => {
  return input;
});
```
