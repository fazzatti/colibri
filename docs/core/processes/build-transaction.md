# BuildTransaction

Creates a Stellar transaction from operations.

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

## Output

Returns a `Transaction` object ready for simulation or signing.

## Errors

| Code      | Description                             |
| --------- | --------------------------------------- |
| `BTX_001` | Invalid base fee format                 |
| `BTX_002` | Base fee too low (must be > 0)          |
| `BTX_003` | Could not load source account from RPC  |
| `BTX_010` | No operations provided                  |
| `BTX_011` | RPC required when sequence not provided |
