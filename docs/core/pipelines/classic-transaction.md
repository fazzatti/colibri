# Classic Transaction Pipeline

For classic Stellar operations (payments, account creation, etc.).

## Process Composition

This pipeline chains the following processes:

1. [P_BuildTransaction](../processes/build-transaction.md) — Creates the transaction
2. [P_EnvelopeSigningRequirements](../processes/envelope-signing-requirements.md) — Determines required signatures
3. [P_SignEnvelope](../processes/sign-envelope.md) — Signs the transaction
4. [P_SendTransaction](../processes/send-transaction.md) — Submits and waits for confirmation

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
