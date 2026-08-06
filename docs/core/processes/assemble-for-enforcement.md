# AssembleForEnforcement

Builds the intermediate transaction needed to enforce completed CAP-71 delegated
credentials.

## `assembleForEnforcement`

```ts
import { assembleForEnforcement } from "@colibri/core";

const transaction = await assembleForEnforcement({
  transaction: baseTransaction,
  authorizedOperation,
  sorobanData: recordingSimulation.transactionData,
  transactionFee: { max: "1000000" },
  resourceFee: "25000",
});
```

## Input

| Property              | Type                 | Required | Description                                                     |
| --------------------- | -------------------- | -------- | --------------------------------------------------------------- |
| `transaction`         | `Transaction`        | Yes      | Original base transaction                                       |
| `authorizedOperation` | `xdr.Operation`      | Yes      | Operation containing signed auth entries                        |
| `sorobanData`         | `SorobanDataBuilder` | No       | Recording-simulation footprint, limits, and resource fee        |
| `transactionFee`      | `TransactionFee`     | No       | Explicit fee strategy propagated from `TransactionConfig`       |
| `resourceFee`         | `string`             | No       | Overrides the resource fee embedded in the recording simulation |

## Behavior

- Returns the original transaction unchanged when the operation contains no
  delegated credentials.
- Assembles signed delegated entries with the recording simulation's Soroban
  data when an enforcing simulation is required.
- Applies the same explicit fee strategy used by final assembly, including a
  total maximum when configured.
- Forwards a resource-fee override to delegated assembly without mutating the
  recording simulation's Soroban data.
- Infers both paths from operation XDR. There is no caller-provided flag.

## Errors

| Code      | Description                                 |
| --------- | ------------------------------------------- |
| `AFE_000` | Unexpected assembly-for-enforcement failure |
| `AFE_001` | Missing transaction                         |
| `AFE_002` | Missing authorized operation                |

Typed `AssembleTransactionError` failures are preserved.
