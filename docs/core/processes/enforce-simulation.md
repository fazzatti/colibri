# EnforceSimulation

Runs the second simulation required after CAP-71 delegated authorization entries
are complete.

## `enforceSimulation`

```ts
import { enforceSimulation } from "@colibri/core";

const simulation = await enforceSimulation({
  transaction: preparedTransaction,
  recordingSimulation,
  rpc: rpcServer,
});
```

## Input

| Property              | Type                        | Required | Description                              |
| --------------------- | --------------------------- | -------- | ---------------------------------------- |
| `transaction`         | `Transaction`               | Yes      | Transaction prepared for enforcement     |
| `recordingSimulation` | `SimulateTransactionOutput` | Yes      | Original recording response              |
| `rpc`                 | `Server`                    | Yes      | RPC server used for enforcing simulation |

## Behavior

- Inspects transaction operations for delegated credentials.
- Returns `recordingSimulation` unchanged and performs no RPC request for
  ordinary authorization.
- Runs and returns a second simulation for delegated authorization. This
  executes custom account checks and provides the resources used by final
  transaction assembly.

## Errors

See
[every code for this context](../../reference/errors/core-processes-enforce-simulation.md)
and the [error-handling guide](../../core/error.md). Failures from lower-level
processes can retain their original context and code.
