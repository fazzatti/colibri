# Fee Bump Plugin

The `@colibri/plugin-fee-bump` package provides fee sponsorship for Soroban transactions.

## Installation

```bash
deno add jsr:@colibri/plugin-fee-bump
```

## Overview

Fee bumping allows a third party (sponsor) to pay transaction fees on behalf of a user. This is useful for:

- **User Onboarding** — New users can interact without holding XLM for fees
- **Sponsored Transactions** — dApps can subsidize user transactions
- **Enterprise Workflows** — Centralized fee payment for organization transactions

## Quick Start

```typescript
import { PIPE_InvokeContract, LocalSigner, NetworkConfig } from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";
import { Operation } from "stellar-sdk";

// User's signer (the one making the contract call)
const userSigner = LocalSigner.fromSecret("USER_SECRET...");

// Sponsor's signer (pays the fees)
const sponsorSigner = LocalSigner.fromSecret("SPONSOR_SECRET...");

const network = NetworkConfig.TestNet();

// Create the pipeline
const pipeline = PIPE_InvokeContract.create({ networkConfig: network });

// Create and add fee bump plugin
const feeBumpPlugin = PLG_FeeBump.create({
  networkConfig: network,
  feeBumpConfig: {
    source: sponsorSigner.publicKey(),
    fee: "1000000", // 0.1 XLM in stroops
    signers: [sponsorSigner],
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

| Property                | Type                  | Description                      |
| ----------------------- | --------------------- | -------------------------------- |
| `networkConfig`         | `NetworkConfig`       | Network configuration            |
| `feeBumpConfig.source`  | `Ed25519PublicKey`    | Account paying the fee           |
| `feeBumpConfig.fee`     | `string`              | Fee in stroops                   |
| `feeBumpConfig.signers` | `TransactionSigner[]` | Signers for fee bump transaction |

### Fee Calculation

The fee bump `fee` must be greater than the inner transaction's fee:

```typescript
PLG_FeeBump.create({
  networkConfig: network,
  feeBumpConfig: {
    source: sponsor.publicKey(),
    fee: "1000000", // 0.1 XLM - safe margin
    signers: [sponsor],
  },
});
```

## How It Works

1. **User transaction is built and signed normally**
2. **Plugin wraps the transaction** in a fee bump envelope
3. **Sponsor signs the fee bump** transaction
4. **Combined transaction is submitted** — sponsor pays fees

```
┌─────────────────────────────────────────────────┐
│               Fee Bump Transaction              │
│  ┌───────────────────────────────────────────┐  │
│  │          Inner Transaction                │  │
│  │   • Contract invocation                   │  │
│  │   • Signed by user                        │  │
│  └───────────────────────────────────────────┘  │
│  • Fee paid by sponsor                          │
│  • Signed by sponsor                            │
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

### Sponsored User Onboarding

```typescript
import {
  PIPE_InvokeContract,
  LocalSigner,
  NetworkConfig,
  initializeWithFriendbot,
} from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";
import { Operation } from "stellar-sdk";

// App sponsor (has XLM for fees)
const sponsor = LocalSigner.fromSecret(Deno.env.get("SPONSOR_KEY")!);

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
    source: sponsor.publicKey(),
    fee: "500000",
    signers: [sponsor],
  },
});
pipeline.addPlugin(feeBumpPlugin, PLG_FeeBump.target);

// User can now make sponsored transactions
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
const sponsor = LocalSigner.fromSecret("S...");

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

Before sponsoring, validate the transaction content:

```typescript
// In production, validate what you're sponsoring
const ALLOWED_CONTRACTS = ["CABC...", "CDEF..."];

if (!ALLOWED_CONTRACTS.includes(contractId)) {
  throw new Error("Contract not allowed for sponsorship");
}
```

### 2. Rate Limiting

Implement rate limiting for sponsored transactions:

```typescript
const userSponsorshipCount = await getUserDailyCount(user);
if (userSponsorshipCount >= MAX_DAILY_SPONSORED) {
  throw new Error("Daily sponsorship limit reached");
}
```

### 3. Fee Limits

Set reasonable fee limits:

```typescript
// Don't sponsor excessive fees
const MAX_SPONSORED_FEE = "5000000"; // 0.5 XLM

PLG_FeeBump.create({
  networkConfig: network,
  feeBumpConfig: {
    source: sponsor.publicKey(),
    fee: MAX_SPONSORED_FEE,
    signers: [sponsor],
  },
});
```

## Next Steps

- [Pipelines](../core/pipelines/README.md) — Pipeline documentation
- [Processes](../core/processes/README.md) — Build fee bump process
- [Signer](../core/signer.md) — Signer configuration
