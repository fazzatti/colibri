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
- `transactionFee: { inclusion: "205" }` writes exactly `205` as the total
  inclusion fee. This remains exact even when there are multiple operations and
  the value is not evenly divisible by their count.
- `transactionFee: { max: "205" }` writes exactly `205` as the complete fee for
  a classic transaction. For Soroban, final assembly recalculates this value
  against the simulated resource fee.

Exact classic inclusion and maximum fees must be at least 100 stroops per
operation. Every exact total must fit Stellar's unsigned 32-bit transaction-fee
field.

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

| Code      | Description                                               |
| --------- | --------------------------------------------------------- |
| `BTX_001` | Invalid base fee                                          |
| `BTX_002` | Base fee is not positive                                  |
| `BTX_003` | Could not load the source account                         |
| `BTX_004` | Could not create the transaction builder                  |
| `BTX_005` | Could not set Soroban data                                |
| `BTX_006` | Could not build the transaction                           |
| `BTX_007` | Could not initialize the source account from the sequence |
| `BTX_008` | Conflicting time constraints                              |
| `BTX_009` | Failed to set preconditions                               |
| `BTX_010` | No operations provided                                    |
| `BTX_011` | RPC required when no sequence is provided                 |
| `BTX_012` | Fee configuration does not select exactly one mode        |
| `BTX_013` | Invalid inclusion fee                                     |
| `BTX_014` | Invalid maximum fee                                       |
| `BTX_015` | Inclusion fee cannot cover the operation minimums         |
| `BTX_016` | Maximum fee cannot cover the operation minimums           |
| `BTX_017` | Exact transaction fee exceeds the XDR limit               |
