# Classic Transaction Pipeline

For classic Stellar operations (payments, account creation, etc.).

## Flow

```
Input → Build → Sign → Send
```

## Usage

```typescript
import {
  PIPE_ClassicTransaction,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { Operation, Asset } from "stellar-sdk";

const signer = LocalSigner.fromSecret("S...");
const network = NetworkConfig.TestNet();

const pipeline = PIPE_ClassicTransaction.create({
  networkConfig: network,
});

const result = await pipeline.run({
  operations: [
    Operation.payment({
      destination: "GDEF...",
      asset: Asset.native(),
      amount: "100",
    }),
  ],
  config: {
    source: signer.publicKey(),
    fee: "100",
    signers: [signer],
  },
});

console.log("Payment sent! TX:", result.hash);
```

## When to Use

Use this pipeline for classic Stellar operations:

- Payments
- Account creation
- Trustline management
- Offers and DEX operations
- Account settings changes
