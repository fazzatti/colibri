# SignEnvelope

Signs the transaction envelope based on signature requirements.

## `P_SignEnvelope`

```typescript
import { P_SignEnvelope } from "@colibri/core";

const result = await P_SignEnvelope().run({
  transaction: assembledTx,
  signatureRequirements: requirements,
  signers: [signer],
});
```

## Input

| Property                | Type                                | Required | Description         |
| ----------------------- | ----------------------------------- | -------- | ------------------- |
| `transaction`           | `Transaction \| FeeBumpTransaction` | Yes      | Transaction to sign |
| `signatureRequirements` | `SignatureRequirement[]`            | Yes      | Required signatures |
| `signers`               | `TransactionSigner[]`               | Yes      | Available signers   |

## Output

Returns the signed `Transaction` or `FeeBumpTransaction`.

## Behavior

The process:

1. Iterates through each signature requirement
2. Finds a matching signer by public key
3. Signs the transaction with that signer
4. Throws if a required signer is not found

## Errors

| Code      | Description                        |
| --------- | ---------------------------------- |
| `SEN_001` | No signature requirements provided |
| `SEN_002` | No signers provided                |
| `SEN_003` | Required signer not found          |
| `SEN_004` | Failed to sign transaction         |
