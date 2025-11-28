# EnvelopeSigningRequirements

Determines which signatures are required for a transaction based on its source account and operations. This analysis is needed to know which signers must sign the transaction envelope before submission.

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

### For Regular Transactions

1. **Extracts source account** — Gets the transaction source, handling muxed addresses by extracting the base Ed25519 key
2. **Sets source requirement** — Source account requires `medium` threshold by default
3. **Analyzes each operation** — Determines the required threshold for each operation type
4. **Resolves "source-account" references** — Operations that use the transaction source (indicated by `"source-account"`) are merged with the source requirement
5. **Deduplicates requirements** — If multiple requirements exist for the same address, uses the highest threshold level

### For Fee Bump Transactions

1. **Extracts fee source** — Gets the fee bump source, handling muxed addresses
2. **Returns single requirement** — Fee source requires `low` threshold signature

### Threshold Resolution

When the same address appears multiple times:
- The highest threshold level wins
- Example: If source needs `medium` for the transaction but `high` for a SetOptions operation, the result is `high`

## Errors

| Code      | Description                                    |
| --------- | ---------------------------------------------- |
| `ESR_001` | Failed to process requirements for fee bump TX |
| `ESR_002` | Failed to process requirements for regular TX  |
| `ESR_003` | Invalid transaction type                       |
