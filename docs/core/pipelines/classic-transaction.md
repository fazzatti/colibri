# Classic Transaction Pipeline

`createClassicTransactionPipeline(...)` is the built-in write pipeline for
classic Stellar operations such as payments, trustlines, and account settings.

## Composition

This pipeline uses:

1. [BuildTransaction](../processes/build-transaction.md)
2. [EnvelopeSigningRequirements](../processes/envelope-signing-requirements.md)
3. [SignEnvelope](../processes/sign-envelope.md)
4. [SendTransaction](../processes/send-transaction.md)

## Usage

```ts
import {
  createClassicTransactionPipeline,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { Asset, Operation } from "npm:@stellar/stellar-sdk";

const signer = LocalSigner.fromSecret("S...");
const network = NetworkConfig.TestNet();

const executeClassicTransaction = createClassicTransactionPipeline({
  networkConfig: network,
});

const result = await executeClassicTransaction({
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

console.log(result.hash);
```

`config.fee` can remain a string base fee or select an explicit strategy. For
example, `{ inclusion: "205" }` sets the total inclusion-fee bid to exactly 205
stroops even for a multi-operation transaction, while `{ max: "205" }` caps the
complete classic transaction fee. See
[Transaction Config](../transaction-config.md).

## Typical Use Cases

- payments
- account creation
- trustline and option changes
- classic transactions that benefit from plugins such as channel accounts
