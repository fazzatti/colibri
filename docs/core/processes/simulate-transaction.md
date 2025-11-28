# SimulateTransaction

Simulates a transaction on the Soroban RPC to calculate resource usage, fees, and authorization requirements.

## `P_SimulateTransaction`

```typescript
import { P_SimulateTransaction } from "@colibri/core";

const result = await P_SimulateTransaction().run({
  transaction: builtTx,
  rpc: rpcServer,
});
```

## Input

| Property      | Type          | Required | Description        |
| ------------- | ------------- | -------- | ------------------ |
| `transaction` | `Transaction` | Yes      | Built transaction  |
| `rpc`         | `Server`      | Yes      | Soroban RPC server |

## Output

Returns either:

- `SimulateTransactionSuccessResponse` — Successful simulation with resource estimates
- `SimulateTransactionRestoreResponse` — Indicates ledger entries need restoration

The response includes:

- `transactionData` — Soroban transaction data (footprint, resource fees)
- `minResourceFee` — Minimum resource fee required
- `result?.auth` — Authorization entries that need signing
- `result?.retval` — Return value from the simulated call

## Errors

| Code      | Description                        |
| --------- | ---------------------------------- |
| `SIM_001` | Simulation failed (contract error) |
| `SIM_002` | Could not reach RPC server         |
| `SIM_003` | Simulation result not verified     |
