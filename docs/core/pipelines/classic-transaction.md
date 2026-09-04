# Classic Transaction Pipeline

`createClassicTransactionPipeline(...)` is the built-in write pipeline for
classic Stellar operations such as payments, trustlines, and account settings.

## Composition

This pipeline uses:

1. [BuildTransaction](../processes/build-transaction.md)
2. [EnvelopeSigningRequirements](../processes/envelope-signing-requirements.md)
3. [SignEnvelope](../processes/sign-envelope.md)
4. [SendTransaction](../processes/send-transaction.md)
5. [ParseClassicTransactionOutcome](../processes/parse-classic-transaction-outcome.md)

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
console.log(result.feeCharged);

const payment = result.operations[0];
if (payment.type === "payment") {
  // `payment.result` is narrowed to xdr.PaymentResultSuccess here.
  console.log(payment.result.type);
}
```

`config.fee` can remain a string base fee or select an explicit strategy. For
example, `{ inclusion: "205" }` sets the total inclusion-fee bid to exactly 205
stroops even for a multi-operation transaction, while `{ max: "205" }` caps the
complete classic transaction fee. See
[Transaction Config](../transaction-config.md).

## Output

The pipeline preserves the normalized `SendTransactionOutput` fields and adds:

- `feeCharged`, the actual total fee reported by Stellar;
- `operations`, a zero-based ordered array of runtime-discriminated successful
  operation outcomes.

Outcomes use the Stellar SDK's operation names and XDR result types. Colibri
does not require separate operation builders or replace the native SDK
operations passed as input. Narrow `outcome.type` at runtime to narrow its
`result` automatically:

```ts
const outcome = result.operations[0];

if (outcome.type === "createClaimableBalance") {
  console.log(outcome.result.balanceId);
}

if (outcome.type === "manageSellOffer") {
  const effect = outcome.result.success.offer.type;
  // effect is manageOfferCreated, manageOfferUpdated, or manageOfferDeleted.
  console.log(effect);
}
```

This is runtime typing rather than compile-time tuple inference: operations are
still ordinary `xdr.Operation` values, so TypeScript cannot know the exact
operation at a given array position until the returned discriminant is checked.

Transaction sources may be either G-addresses or M-addresses. For a muxed
source, Colibri loads and signs through the underlying G-account while
preserving the M-address in the submitted envelope.

## Typical Use Cases

- payments
- account creation
- trustline and option changes
- classic transactions that benefit from plugins such as channel accounts
