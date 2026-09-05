# WrapFeeBump

Wraps a transaction with a fee bump, enabling fee sponsorship. A fee bump allows
a different account to pay for a transaction's fees, useful for improving user
experience or handling fee increases after initial signing.

## `wrapFeeBump`

```typescript
import { wrapFeeBump } from "@colibri/core";

const result = await wrapFeeBump({
  transaction: innerTx,
  config: {
    source: sponsorPublicKey,
    fee: "1000000",
    signers: [sponsorSigner],
  },
  networkPassphrase: "Test SDF Network ; September 2015",
});
```

## Input

| Property            | Type            | Required | Description               |
| ------------------- | --------------- | -------- | ------------------------- |
| `transaction`       | `Transaction`   | Yes      | Inner transaction to wrap |
| `config`            | `FeeBumpConfig` | Yes      | Fee bump configuration    |
| `networkPassphrase` | `string`        | Yes      | Network passphrase        |

### FeeBumpConfig

| Property  | Type                                             | Description                                                        |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `source`  | `TransactionSource`                              | Fee bump source as a G-address or M-address                        |
| `fee`     | `BaseFee`                                        | Outer inclusion bid per operation, excluding Soroban resource fees |
| `signers` | `(EnvelopeSigner \| PreAuthTransactionSigner)[]` | Signers that authorize or pre-authorize the outer envelope         |

## Output

Returns a `FeeBumpTransaction` wrapping the inner transaction.

## Behavior

### Validations

1. **Validates required arguments** — Ensures `transaction`,
   `networkPassphrase`, `config`, `config.source`, and `config.fee` are all
   present
2. **Verifies not already a fee bump** — The input transaction cannot already be
   a fee bump transaction (no double-wrapping)
3. **Verifies is a valid transaction** — Ensures the input is a proper
   Transaction object
4. **Validates fee** — The outer base fee must be at least 100 stroops and at
   least the inner inclusion fee divided by its operation count. Equal bids are
   valid. The inner Soroban resource fee is excluded from this comparison.

### Fee Bump Construction

The process uses `TransactionBuilder.buildFeeBumpTransaction()` with:

- The fee bump source's G-address or M-address
- The outer per-operation base fee
- The original inner transaction
- The network passphrase

The outer total is `base fee × (inner operation count + 1) + resource fee`. For
example, two classic operations with a 200-stroop inner total can use an outer
base fee of 150, producing a 450-stroop outer total. A Soroban inner transaction
with 205 stroops of inclusion and 5,000 of resources can use an outer base fee
of 205, producing a 5,410-stroop outer total.

### After Creation

The fee bump transaction must then be signed by the fee bump source before
submission. The inner transaction's signatures are preserved.

When the source is muxed, the envelope preserves the M-address and signing is
resolved against its embedded base G-account.

## Errors

See
[every code for this context](../../reference/errors/core-processes-wrap-fee-bump.md)
and the [error-handling guide](../../core/error.md). Failures from lower-level
processes can retain their original context and code.

## See Also

- [Fee Bump Plugin](../../packages/plugins/fee-bump.md) — Integrates fee bumps
  into pipelines
