# @colibri/plugin-fee-bump

The `@colibri/plugin-fee-bump` package allows a separate account to cover network fees for Soroban transactions.

## Installation

```bash
deno add jsr:@colibri/plugin-fee-bump
```

## Overview

Fee bumping allows a different account (the fee bump source) to pay transaction fees on behalf of the user. This is useful for:

- **User Onboarding** — New users can interact without holding XLM for fees
- **Covered Network Fees** — dApps can subsidize user transactions
- **Enterprise Workflows** — Centralized fee payment for organization transactions

## Quick Start

```typescript
import { PIPE_InvokeContract, LocalSigner, NetworkConfig } from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";
import { Operation } from "stellar-sdk";

// User's signer (the one making the contract call)
const userSigner = LocalSigner.fromSecret("USER_SECRET...");

// Fee bump source's signer (covers the fees)
const feeSourceSigner = LocalSigner.fromSecret("FEE_SOURCE_SECRET...");

const network = NetworkConfig.TestNet();

// Create the pipeline
const pipeline = PIPE_InvokeContract.create({ networkConfig: network });

// Create and add fee bump plugin
const feeBumpPlugin = PLG_FeeBump.create({
  networkConfig: network,
  feeBumpConfig: {
    source: feeSourceSigner.publicKey(),
    fee: "1000000", // 0.1 XLM in stroops
    signers: [feeSourceSigner],
  },
});
pipeline.addPlugin(feeBumpPlugin, PLG_FeeBump.target);

// Run the pipeline
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
    signers: [userSigner],
  },
});
```

## PLG_FeeBump

Factory object for creating fee bump plugin instances.

### Creating a Plugin

```typescript
const plugin = PLG_FeeBump.create(config);
```

### Configuration

```typescript
interface FeeBumpPluginConfig {
  networkConfig: NetworkConfig;
  feeBumpConfig: {
    source: Ed25519PublicKey;
    fee: string;
    signers: TransactionSigner[];
  };
}
```

| Property                | Type                  | Description                          |
| ----------------------- | --------------------- | ------------------------------------ |
| `networkConfig`         | `NetworkConfig`       | Network configuration                |
| `feeBumpConfig.source`  | `Ed25519PublicKey`    | Account covering the fee             |
| `feeBumpConfig.fee`     | `string`              | Fee in stroops                       |
| `feeBumpConfig.signers` | `TransactionSigner[]` | Signers for the fee bump transaction |

### Fee Calculation

The fee bump `fee` must be greater than the inner transaction's fee:

```typescript
PLG_FeeBump.create({
  networkConfig: network,
  feeBumpConfig: {
    source: feeSource.publicKey(),
    fee: "1000000", // 0.1 XLM - safe margin
    signers: [feeSource],
  },
});
```

## How It Works

1. **User transaction is built and signed normally**
2. **Plugin wraps the transaction** in a fee bump envelope
3. **Fee bump source signs** the fee bump transaction
4. **Combined transaction is submitted** — fee bump source pays fees

```
┌─────────────────────────────────────────────────┐
│               Fee Bump Transaction              │
│  ┌───────────────────────────────────────────┐  │
│  │          Inner Transaction                │  │
│  │   • Contract invocation                   │  │
│  │   • Signed by user                        │  │
│  └───────────────────────────────────────────┘  │
│  • Fee covered by fee bump source               │
│  • Signed by fee bump source                    │
└─────────────────────────────────────────────────┘
```

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
import { Operation } from "stellar-sdk";

// App's fee account (has XLM for fees)
const feeSource = LocalSigner.fromSecret(Deno.env.get("FEE_SOURCE_KEY")!);

// New user (may have zero XLM)
const newUser = LocalSigner.generateRandom();

// Fund user account on TestNet (required for account to exist)
const network = NetworkConfig.TestNet();
await initializeWithFriendbot(network.friendbotUrl, newUser.publicKey());

// Create pipeline with fee bump
const pipeline = PIPE_InvokeContract.create({ networkConfig: network });

const feeBumpPlugin = PLG_FeeBump.create({
  networkConfig: network,
  feeBumpConfig: {
    source: feeSource.publicKey(),
    fee: "500000",
    signers: [feeSource],
  },
});
pipeline.addPlugin(feeBumpPlugin, PLG_FeeBump.target);

// User can now make transactions with covered fees
const result = await pipeline.run({
  operations: [
    Operation.invokeContractFunction({
      contract: "CABC...",
      function: "register",
      args: [...],
    }),
  ],
  config: {
    source: newUser.publicKey(),
    fee: "100000",
    signers: [newUser],
  },
});
```

### Enterprise Fee Management

```typescript
import {
  PIPE_InvokeContract,
  NetworkConfig,
  LocalSigner,
  TransactionSigner,
} from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";
import { Operation, xdr } from "stellar-sdk";

// Central treasury account pays all fees
const treasury = LocalSigner.fromSecret(TREASURY_KEY);
const network = NetworkConfig.MainNet();

async function executeUserTransaction(
  user: TransactionSigner,
  contractId: string,
  method: string,
  args: xdr.ScVal[]
) {
  const pipeline = PIPE_InvokeContract.create({ networkConfig: network });

  const feeBumpPlugin = PLG_FeeBump.create({
    networkConfig: network,
    feeBumpConfig: {
      source: treasury.publicKey(),
      fee: "2000000", // 0.2 XLM per transaction
      signers: [treasury],
    },
  });
  pipeline.addPlugin(feeBumpPlugin, PLG_FeeBump.target);

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
      signers: [user],
    },
  });
}
```

### Dynamic Fee Calculation

```typescript
import { Contract, NetworkConfig, LocalSigner } from "@colibri/core";

const network = NetworkConfig.TestNet();
const feeSource = LocalSigner.fromSecret("S...");

// Use Contract.read() to simulate and get fee estimate
const contract = Contract.create({
  networkConfig: network,
  contractConfig: { contractId: "CABC..." },
});

// Read operations don't submit, just simulate
const readResult = await contract.read({
  method: "get_state",
  methodArgs: {},
});

// For actual invocation with fee bump, estimate fee and add buffer
// The simulation gives you an idea of resource usage
```

## Security Considerations

### 1. Validate Transactions

Before covering fees, validate the transaction content:

```typescript
// In production, validate what you're covering fees for
const ALLOWED_CONTRACTS = ["CABC...", "CDEF..."];

if (!ALLOWED_CONTRACTS.includes(contractId)) {
  throw new Error("Contract not allowed for fee coverage");
}
```

### 2. Rate Limiting

Implement rate limiting for covered transactions:

```typescript
const userCoveredCount = await getUserDailyCount(user);
if (userCoveredCount >= MAX_DAILY_COVERED) {
  throw new Error("Daily fee coverage limit reached");
}
```

### 3. Fee Limits

Set reasonable fee limits:

```typescript
// Don't cover excessive fees
const MAX_COVERED_FEE = "5000000"; // 0.5 XLM

PLG_FeeBump.create({
  networkConfig: network,
  feeBumpConfig: {
    source: feeSource.publicKey(),
    fee: MAX_COVERED_FEE,
    signers: [feeSource],
  },
});
```

## Next Steps

- [Pipelines](../../core/pipelines/README.md) — Pipeline documentation
- [Processes](../../core/processes/README.md) — Build fee bump process
- [Signer](../../core/signer/README.md) — Signer configuration
