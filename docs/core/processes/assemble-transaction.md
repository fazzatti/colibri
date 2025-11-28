# AssembleTransaction

Attaches simulation results (footprint, authorization entries, resource fees) to a transaction, making it ready for signing. This process reconstructs the transaction with all the Soroban-specific data from simulation.

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

## Behavior

1. **Validates required arguments** — Ensures `transaction` and `resourceFee` are present
2. **Verifies smart contract transaction** — Confirms the transaction is a Soroban transaction
3. **Verifies operation type** — Checks that the operation is `invokeHostFunction`
4. **Rebuilds the operation** — Reconstructs the invoke host function operation with the provided auth entries (signed or unsigned)
5. **Calculates total fee** — Combines the original inclusion fee (`baseFee`) with the `resourceFee` from simulation
6. **Preserves transaction settings** — Maintains all original transaction properties:
   - Memo
   - Time bounds
   - Ledger bounds
   - Min sequence constraints
   - Extra signers
7. **Attaches Soroban data** — Sets the `sorobanData` (footprint and resources) on the transaction

The assembled transaction has the correct fee structure and all necessary Soroban metadata to be valid on the network.

## Errors

| Code      | Description                      |
| --------- | -------------------------------- |
| `ASM_001` | Missing required argument        |
| `ASM_002` | Not a smart contract transaction |
| `ASM_003` | Unsupported operation type       |
| `ASM_004` | Failed to build Soroban data     |
