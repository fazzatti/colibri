# BuildTransaction

Creates a Stellar transaction from operations, a source account, and a fee
strategy. The output is ready for simulation or envelope signing.

## `buildTransaction`

Use either `baseFee` or `transactionFee`, never both:

```ts
import { buildTransaction } from "@colibri/core";

const baseFeeTransaction = await buildTransaction({
  operations,
  source: "GABC...",
  baseFee: "100",
  networkPassphrase: "Test SDF Network ; September 2015",
  rpc,
});

const exactInclusionTransaction = await buildTransaction({
  operations,
  source: "GABC...",
  transactionFee: { inclusion: "205" },
  networkPassphrase: "Test SDF Network ; September 2015",
  rpc,
});
```

## Input

| Property            | Type                       | Required           | Description                                          |
| ------------------- | -------------------------- | ------------------ | ---------------------------------------------------- |
| `operations`        | `xdr.Operation[]`          | Yes                | Operations added to the transaction                  |
| `source`            | `Ed25519PublicKey`         | Yes                | Source account public key                            |
| `baseFee`           | `BaseFee`                  | One fee input      | Existing Stellar SDK per-operation base-fee behavior |
| `transactionFee`    | `TransactionFee`           | One fee input      | Explicit `base`, `inclusion`, or `max` strategy      |
| `networkPassphrase` | `string`                   | Yes                | Network passphrase                                   |
| `rpc`               | `Server`                   | One sequence input | RPC used to load the account sequence                |
| `sequence`          | `string`                   | One sequence input | Explicit source-account sequence                     |
| `sorobanData`       | `SorobanTransactionData`   | No                 | Pre-built Soroban data                               |
| `memo`              | `Memo`                     | No                 | Transaction memo                                     |
| `preconditions`     | `TransactionPreconditions` | No                 | Time bounds, ledger bounds, and signer requirements  |

Exactly one of `baseFee` or `transactionFee` is required. Either `rpc` or
`sequence` must also be provided. When `rpc` is selected, the process loads the
current sequence from the network.

### Explicit Fee Strategies

- `transactionFee: { base: "100" }` uses `100` as the per-operation base fee.
- `transactionFee: { inclusion: "205" }` writes exactly `205` as the
  transaction's inclusion-fee component. This remains exact even when there are
  multiple operations and the value is not evenly divisible by their count. If
  `sorobanData` is supplied, its resource fee is added once.
- `transactionFee: { max: "205" }` writes exactly `205` as the complete fee. If
  `sorobanData` is supplied, that maximum must cover its resource fee plus the
  minimum inclusion fee.

Exact classic inclusion and maximum fees must be at least 100 stroops per
operation. Resource-inclusive totals must fit Stellar's unsigned 32-bit
transaction-fee field. The invoke-contract pipeline recalculates the final
amount from the latest simulation data during assembly.

### Preconditions

The `preconditions` object supports:

| Property                      | Type               | Description                                               |
| ----------------------------- | ------------------ | --------------------------------------------------------- |
| `timeBounds`                  | `TimeBounds`       | Explicit time bounds (`minTime`, `maxTime`)               |
| `timeoutSeconds`              | `number`           | Timeout from now; cannot be combined with `timeBounds`    |
| `ledgerBounds`                | `LedgerBounds`     | Ledger bounds (`minLedger`, `maxLedger`)                  |
| `minAccountSequence`          | `string`           | Minimum account sequence                                  |
| `minAccountSequenceAge`       | `bigint`           | Minimum sequence age in seconds                           |
| `minAccountSequenceLedgerGap` | `number`           | Minimum gap from the last sequence change                 |
| `extraSigners`                | `ExtraSignerKey[]` | Additional required `G...`, `X...`, or `P...` signer keys |

## Output

Returns a `Transaction` ready for simulation or signing.

## Errors

See
[every code for this context](../../reference/errors/core-processes-build-transaction.md)
and the [error-handling guide](../../core/error.md). Failures from lower-level
processes can retain their original context and code.
