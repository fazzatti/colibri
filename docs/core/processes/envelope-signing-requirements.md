# EnvelopeSigningRequirements

Determines which signatures are required for a transaction based on its source account and operations.

## `P_EnvelopeSigningRequirements`

```typescript
import { P_EnvelopeSigningRequirements } from "@colibri/core";

const result = await P_EnvelopeSigningRequirements().run({
  transaction: assembledTx,
});
```

## Input

| Property      | Type                                | Required | Description            |
| ------------- | ----------------------------------- | -------- | ---------------------- |
| `transaction` | `Transaction \| FeeBumpTransaction` | Yes      | Transaction to analyze |

## Output

Returns `SignatureRequirement[]`:

```typescript
type SignatureRequirement = {
  address: Ed25519PublicKey;
  thresholdLevel: OperationThreshold;
};
```

Each requirement specifies:

- `address` — The public key that must sign
- `thresholdLevel` — The threshold level required (`low`, `medium`, `high`)

## Behavior

For a regular transaction:

- Source account requires `medium` threshold signature
- Each operation may add additional requirements based on its type

For a fee bump transaction:

- Fee source requires `low` threshold signature

## Errors

| Code      | Description                                    |
| --------- | ---------------------------------------------- |
| `ESR_001` | Failed to process requirements for fee bump TX |
| `ESR_002` | Failed to process requirements for regular TX  |
