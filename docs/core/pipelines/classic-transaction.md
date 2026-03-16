# Classic Transaction Pipeline

For classic Stellar operations (payments, account creation, etc.).

## Composition

This pipeline uses step wrappers around the following raw processes:

1. [buildTransaction](../processes/build-transaction.md) — Creates the transaction
2. [envelopeSigningRequirements](../processes/envelope-signing-requirements.md) — Determines required signatures
3. [signEnvelope](../processes/sign-envelope.md) — Signs the transaction
4. [sendTransaction](../processes/send-transaction.md) — Submits and waits for confirmation

Between those steps, Colibri uses shared connectors to adapt pipeline input, signing requirements, and final output.

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
    timeout: 30,
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
