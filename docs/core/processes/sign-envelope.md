# SignEnvelope

Authorizes a transaction from account signature requirements and exact
`extraSigners` preconditions. Depending on the selected signer mechanism, it
either adds a decorated signature or verifies a pre-authorized transaction hash.

## `signEnvelope`

```typescript
import { signEnvelope } from "@colibri/core";

const result = await signEnvelope({
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
| `signers`               | `Signer[]`                          | Yes      | Available signers   |

## Output

Returns the signed `Transaction` or `FeeBumpTransaction`.

## Behavior

1. **Validates requirements** — Ensures at least one signature requirement
   exists
2. **Validates signers** — Ensures at least one signer is provided
3. **Resolves account requirements** — Uses `signsFor(account)` and requires
   exactly one distinct signer key per account.
4. **Resolves exact extra signers** — Matches every transaction precondition by
   `signerKey()`.
5. **Deduplicates selected identities** — A signer selected by both routes runs
   once.
6. **Executes the selected mechanism** — Envelope signers add their decorated
   signature. Pre-authorized transaction signers verify the exact transaction
   hash without mutating the envelope.
7. **Deserializes after each signature** — Accumulates signatures while
   preserving the embedded network passphrase.

The process is strict. It does not select by signer-array order, guess signer
precedence, or implement weighted multi-signature policy.

## Errors

See
[every code for this context](../../reference/errors/core-processes-sign-envelope.md)
and the [error-handling guide](../../core/error.md). Failures from lower-level
processes can retain their original context and code.
