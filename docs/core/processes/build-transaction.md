# BuildTransaction

Creates a Stellar transaction from operations. This is the foundational step that takes your operations, source account, and configuration to produce a transaction ready for simulation or signing.

## `P_BuildTransaction`

```typescript
import { P_BuildTransaction } from "@colibri/core";

const result = await P_BuildTransaction().run({
  operations: [Operation.invokeContractFunction({...})],
  source: "GABC...",
  baseFee: "100000",
  networkPassphrase: "Test SDF Network ; September 2015",
  rpc: rpcServer,
});
```

## Input

| Property            | Type                       | Required | Description                           |
| ------------------- | -------------------------- | -------- | ------------------------------------- |
| `operations`        | `xdr.Operation[]`          | Yes      | Array of operations                   |
| `source`            | `Ed25519PublicKey`         | Yes      | Source account public key             |
| `baseFee`           | `BaseFee`                  | Yes      | Fee in stroops (e.g., `"100000"`)     |
| `networkPassphrase` | `string`                   | Yes      | Network passphrase                    |
| `rpc`               | `Server`                   | —        | RPC server (required if no sequence)  |
| `sequence`          | `string`                   | —        | Account sequence (required if no rpc) |
| `sorobanData`       | `SorobanTransactionData`   | —        | Pre-built Soroban data                |
| `memo`              | `Memo`                     | —        | Transaction memo                      |
| `preconditions`     | `TransactionPreconditions` | —        | Time bounds, ledger bounds, etc.      |

Either `rpc` or `sequence` must be provided. If `rpc` is provided, the process fetches the current sequence from the network.

### Preconditions

The `preconditions` object supports:

| Property                      | Type           | Description                                  |
| ----------------------------- | -------------- | -------------------------------------------- |
| `timeBounds`                  | `TimeBounds`   | Explicit time bounds (`minTime`, `maxTime`)  |
| `timeoutSeconds`              | `number`       | Timeout from now (cannot use with timeBounds)|
| `ledgerBounds`                | `LedgerBounds` | Ledger bounds (`minLedger`, `maxLedger`)     |
| `minAccountSequence`          | `string`       | Minimum account sequence                     |
| `minAccountSequenceAge`       | `number`       | Minimum sequence age in seconds              |
| `minAccountSequenceLedgerGap` | `number`       | Minimum gap from last sequence change        |
| `extraSigners`                | `SignerKey[]`  | Additional required signers                  |

## Output

Returns a `Transaction` object ready for simulation or signing.

## Behavior

1. **Validates baseFee** — Must be a valid number and greater than 0
2. **Validates operations** — Array must not be empty
3. **Loads account sequence** — Either uses provided `sequence` or loads from RPC
4. **Attaches sorobanData** — If provided, adds Soroban transaction data
5. **Processes preconditions**:
   - Validates that `timeBounds` and `timeoutSeconds` are not both specified
   - Sets time bounds if provided
   - Sets ledger bounds, min sequence constraints, and extra signers if provided
6. **Sets timeout** — If no explicit time constraints, sets to `TimeoutInfinite` (no limit)
7. **Attaches memo** — If provided

## Errors

| Code      | Description                                            |
| --------- | ------------------------------------------------------ |
| `BTX_001` | Invalid base fee format (not a valid number)           |
| `BTX_002` | Base fee too low (must be > 0)                         |
| `BTX_003` | Could not load source account from RPC                 |
| `BTX_010` | No operations provided                                 |
| `BTX_011` | RPC required when sequence not provided                |
| `BTX_012` | Cannot specify both timeBounds and timeoutSeconds      |
