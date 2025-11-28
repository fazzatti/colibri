# SignEnvelope

Signs the transaction envelope based on signature requirements. This process takes the signature requirements from `P_EnvelopeSigningRequirements` and applies signatures from the available signers.

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

1. **Validates requirements** — Ensures at least one signature requirement exists
2. **Validates signers** — Ensures at least one signer is provided
3. **Iterates through requirements** — For each signature requirement:
   - Finds a signer with matching public key
   - Throws `SIGNER_NOT_FOUND` if no match exists
   - Signs the transaction with the signer
4. **Deserializes after each signature** — Converts the signed XDR back to a transaction object to accumulate signatures
5. **Preserves network passphrase** — Uses the transaction's embedded network passphrase for deserialization

The process is strict — it requires a signer for every requirement. If you want to partially sign (for multi-sig scenarios where different parties sign at different times), you'll need to filter the requirements first.

## Errors

| Code      | Description                        |
| --------- | ---------------------------------- |
| `SEN_001` | No signature requirements provided |
| `SEN_002` | No signers provided                |
| `SEN_003` | Required signer not found          |
| `SEN_004` | Failed to sign transaction         |
