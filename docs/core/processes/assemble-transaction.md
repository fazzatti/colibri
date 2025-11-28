# AssembleTransaction

Attaches simulation results (footprint, authorization entries, resource fees) to a transaction, making it ready for signing.

## `P_AssembleTransaction`

```typescript
import { P_AssembleTransaction } from "@colibri/core";

const result = await P_AssembleTransaction().run({
  transaction: builtTx,
  authEntries: signedAuthEntries,
  sorobanData: simulation.transactionData,
  resourceFee: simulation.minResourceFee,
});
```

## Input

| Property      | Type                          | Required | Description                      |
| ------------- | ----------------------------- | -------- | -------------------------------- |
| `transaction` | `Transaction`                 | Yes      | Built transaction                |
| `resourceFee` | `number`                      | Yes      | Resource fee from simulation     |
| `authEntries` | `SorobanAuthorizationEntry[]` | —        | Signed authorization entries     |
| `sorobanData` | `SorobanDataBuilder`          | —        | Transaction data from simulation |

## Output

Returns an assembled `Transaction` with Soroban data attached, ready for envelope signing.

## Errors

| Code      | Description                      |
| --------- | -------------------------------- |
| `ASM_001` | Missing required argument        |
| `ASM_002` | Not a smart contract transaction |
| `ASM_003` | Unsupported operation type       |
| `ASM_004` | Failed to build Soroban data     |
