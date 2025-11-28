# WrapFeeBump

Wraps a transaction with a fee bump, enabling fee sponsorship.

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

The process:

1. Validates the inner transaction is not already a fee bump
2. Validates the fee bump fee is greater than the inner transaction fee
3. Builds the fee bump transaction

The fee bump transaction must then be signed by the fee source before submission.

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
