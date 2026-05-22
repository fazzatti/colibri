# SimulateTransaction

Simulates a transaction on the Soroban RPC to calculate resource usage, fees,
and authorization requirements. Simulation is required before submitting any
Soroban transaction to determine the exact resources it will consume.

## `simulateTransaction`

```typescript
import { simulateTransaction } from "@colibri/core";

const result = await simulateTransaction({
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

- `SimulateTransactionSuccessResponse` — Successful simulation with resource
  estimates
- `SimulateTransactionRestoreResponse` — Indicates ledger entries need
  restoration

The response includes:

- `transactionData` — Soroban transaction data (footprint, resource fees)
- `minResourceFee` — Minimum resource fee required
- `result?.auth` — Authorization entries that need signing
- `result?.retval` — Return value from the simulated call

## Behavior

1. **Sends to RPC** — Calls `rpc.simulateTransaction()` with the built
   transaction
2. **Checks for simulation error** — If RPC returns an error response, parses
   diagnostic events and throws either `SIMULATION_FAILED` or
   `CONTRACT_ERROR_SIMULATION_FAILED`
3. **Handles restore response** — If ledger entries need restoration, returns a
   `SimulateTransactionRestoreResponse`. You'll need to restore the entries
   before the main transaction can succeed.
4. **Returns success response** — On successful simulation, returns the full
   response with resource data and authorization entries

The process distinguishes between different response types by checking the
response structure, ensuring you always know what state your transaction is in.

## Contract Error Diagnostics

When RPC reports a failed simulation with `Error(Contract, #code)`,
`simulateTransaction` throws `CONTRACT_ERROR_SIMULATION_FAILED` instead of the
generic simulation error.

The error contains parsed metadata:

```ts
import { ColibriError } from "@colibri/core";

try {
  await simulateTransaction({ transaction, rpc });
} catch (error) {
  if (ColibriError.is(error) && error.code === "SIM_004") {
    console.log(error.meta.data.contractError.code);
    console.log(error.meta.data.contractErrorStack);
    console.log(error.meta.data.diagnosticEvents);
  }
}
```

The contract-error stack contains the parsed contract error events Colibri could
identify from the simulation diagnostics. Each item includes:

| Field        | Description                                      |
| ------------ | ------------------------------------------------ |
| `code`       | Numeric contract error code                      |
| `contractId` | Contract that emitted the diagnostic error event |
| `issuedFrom` | `root-invocation` or `sub-invocation`            |
| `eventIndex` | Position in the parsed diagnostic event list     |
| `data`       | Parsed diagnostic event data                     |

Use `parseFailedSimulationResponse(...)` if you already have a failed RPC
simulation response and want to inspect the same parsed shape without running
the process.

```ts
import { parseFailedSimulationResponse } from "@colibri/core";

const parsed = parseFailedSimulationResponse(simulationResponse);
console.log(parsed.contractError?.code);
```

For human-friendly application errors, attach the
[Contract Error Matcher](../plugins/contract-error-matcher.md) plugin.

## Errors

| Code      | Description                                              |
| --------- | -------------------------------------------------------- |
| `SIM_000` | Unexpected non-Colibri error escaped simulation handling |
| `SIM_001` | Simulation failed without a parsed contract error        |
| `SIM_002` | Could not reach RPC server                               |
| `SIM_003` | Simulation result not verified (unknown response)        |
| `SIM_004` | Simulation failed with a parsed contract error           |
