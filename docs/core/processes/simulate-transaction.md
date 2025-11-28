# SimulateTransaction

Simulates a transaction on the Soroban RPC to calculate resource usage, fees, and authorization requirements. Simulation is required before submitting any Soroban transaction to determine the exact resources it will consume.

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

## Behavior

1. **Sends to RPC** — Calls `rpc.simulateTransaction()` with the built transaction
2. **Checks for simulation error** — If RPC returns an error response, throws `SIMULATION_FAILED`
3. **Handles restore response** — If ledger entries need restoration, returns a `SimulateTransactionRestoreResponse`. You'll need to restore the entries before the main transaction can succeed.
4. **Returns success response** — On successful simulation, returns the full response with resource data and authorization entries

The process distinguishes between different response types by checking the response structure, ensuring you always know what state your transaction is in.

## Errors

| Code      | Description                                       |
| --------- | ------------------------------------------------- |
| `SIM_001` | Simulation failed — contract reverted or invalid  |
| `SIM_002` | Could not reach RPC server                        |
| `SIM_003` | Simulation result not verified (unknown response) |
