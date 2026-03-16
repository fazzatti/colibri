# @colibri/plugin-fee-bump

The `@colibri/plugin-fee-bump` package lets a separate account cover the network fees for a transaction. It targets the `SendTransaction` step from `@colibri/core`, so it can be attached to any pipeline that includes `steps.SEND_TRANSACTION_STEP_ID`.

## Installation

```bash
deno add jsr:@colibri/plugin-fee-bump
```

## Quick Start

```typescript
import { PIPE_InvokeContract, LocalSigner, NetworkConfig } from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";
import { Operation } from "stellar-sdk";

const userSigner = LocalSigner.fromSecret("USER_SECRET...");
const sponsorSigner = LocalSigner.fromSecret("SPONSOR_SECRET...");
const network = NetworkConfig.TestNet();

const pipeline = PIPE_InvokeContract.create({ networkConfig: network });

pipeline.use(
  PLG_FeeBump.create({
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
      args: [...],
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

## Configuration

`PLG_FeeBump.create(...)` accepts:

| Property                | Type               | Description                          |
| ----------------------- | ------------------ | ------------------------------------ |
| `networkConfig`         | `NetworkConfig`    | Network configuration                |
| `feeBumpConfig.source`  | `Ed25519PublicKey` | Account covering the fee             |
| `feeBumpConfig.fee`     | `string`           | Base fee in stroops for the fee bump |
| `feeBumpConfig.signers` | `Signer[]`         | Signers for the fee bump transaction |

## How It Works

1. Your pipeline reaches the `SendTransaction` step
2. The plugin intercepts the step input
3. It wraps the outgoing transaction in a fee bump envelope
4. It signs the fee bump with the configured sponsor signers
5. The wrapped transaction continues to `sendTransaction`

The inner transaction signatures are preserved. Only the outer fee bump envelope is added.

## Error Handling

### Error Codes

| Code          | Class               | Description                      |
| ------------- | ------------------- | -------------------------------- |
| `PLG_FBP_000` | `UNEXPECTED_ERROR`  | An unexpected error occurred     |
| `PLG_FBP_001` | `MISSING_ARG`       | Required argument not provided   |
| `PLG_FBP_002` | `NOT_A_TRANSACTION` | Input is not a valid Transaction |

### Handling Errors

```typescript
import { ColibriError } from "@colibri/core";

try {
  const result = await pipeline.run({...});
  console.log("Success:", result.hash);
} catch (error) {
  if (error instanceof ColibriError) {
    switch (error.code) {
      case "PLG_FBP_001":
        console.log("Missing required argument");
        break;
      case "PLG_FBP_002":
        console.log("Invalid transaction type");
        break;
      case "WFB_005":
        console.log("Fee bump fee too low");
        break;
    }
  }
}
```

## Usage Patterns

### Covered Fees for User Onboarding

```typescript
import {
  PIPE_InvokeContract,
  LocalSigner,
  NetworkConfig,
  initializeWithFriendbot,
} from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";

const feeSource = LocalSigner.fromSecret(Deno.env.get("FEE_SOURCE_KEY")!);
const newUser = LocalSigner.generateRandom();
const network = NetworkConfig.TestNet();

await initializeWithFriendbot(network.friendbotUrl, newUser.publicKey(), {
  rpcUrl: network.rpcUrl,
});

const pipeline = PIPE_InvokeContract.create({ networkConfig: network });

pipeline.use(
  PLG_FeeBump.create({
    networkConfig: network,
    feeBumpConfig: {
      source: feeSource.publicKey(),
      fee: "500000",
      signers: [feeSource],
    },
  }),
);
```

### Enterprise Fee Management

```typescript
import {
  PIPE_InvokeContract,
  NetworkConfig,
  LocalSigner,
  Signer,
} from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";
import { Operation, xdr } from "stellar-sdk";

const treasury = LocalSigner.fromSecret(TREASURY_KEY);
const network = NetworkConfig.MainNet();

async function executeUserTransaction(
  user: Signer,
  contractId: string,
  method: string,
  args: xdr.ScVal[],
) {
  const pipeline = PIPE_InvokeContract.create({ networkConfig: network });

  pipeline.use(
    PLG_FeeBump.create({
      networkConfig: network,
      feeBumpConfig: {
        source: treasury.publicKey(),
        fee: "2000000",
        signers: [treasury],
      },
    }),
  );

  return pipeline.run({
    operations: [
      Operation.invokeContractFunction({
        contract: contractId,
        function: method,
        args,
      }),
    ],
    config: {
      source: user.publicKey(),
      fee: "100000",
      timeout: 30,
      signers: [user],
    },
  });
}
```

## Next Steps

- [Pipelines](../../core/pipelines/README.md) — Pipeline documentation
- [WrapFeeBump](../../core/processes/wrap-fee-bump.md) — Raw fee bump process
- [Signer](../../core/signer/README.md) — Signer configuration
