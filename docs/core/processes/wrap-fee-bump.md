# WrapFeeBump

Wraps a transaction with a fee bump, enabling fee sponsorship. A fee bump allows a different account to pay for a transaction's fees, useful for improving user experience or handling fee increases after initial signing.

## `P_WrapFeeBump`

```typescript
import { P_WrapFeeBump } from "@colibri/core";

const result = await P_WrapFeeBump().run({
  transaction: innerTx,
  config: {
    source: sponsorPublicKey,
    fee: "1000000",
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

| Property | Type               | Description                   |
| -------- | ------------------ | ----------------------------- |
| `source` | `Ed25519PublicKey` | Fee bump source (sponsor)     |
| `fee`    | `BaseFee`          | Total fee (must exceed inner) |

## Output

Returns a `FeeBumpTransaction` wrapping the inner transaction.

## Behavior

### Validations

1. **Validates required arguments** — Ensures `transaction`, `networkPassphrase`, `config`, `config.source`, and `config.fee` are all present
2. **Verifies not already a fee bump** — The input transaction cannot already be a fee bump transaction (no double-wrapping)
3. **Verifies is a valid transaction** — Ensures the input is a proper Transaction object
4. **Validates fee** — The fee bump fee must be strictly greater than the inner transaction's fee

### Fee Bump Construction

The process uses `TransactionBuilder.buildFeeBumpTransaction()` with:
- The sponsor's public key as the fee source
- The new (higher) fee
- The original inner transaction
- The network passphrase

### After Creation

The fee bump transaction must then be signed by the fee source (sponsor) before submission. The inner transaction's signatures are preserved.

## Errors

| Code      | Description                           |
| --------- | ------------------------------------- |
| `WFB_001` | Missing required argument             |
| `WFB_002` | Transaction is already a fee bump     |
| `WFB_003` | Not a valid transaction               |
| `WFB_004` | Fee bump fee must exceed inner tx fee |
| `WFB_005` | Failed to build fee bump transaction  |

## See Also

- [Fee Bump Plugin](../../packages/plugin-fee-bump.md) — Integrates fee bumps into pipelines
