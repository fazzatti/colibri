# AssembleForEnforcement

Builds the intermediate transaction needed to enforce completed CAP-71
delegated credentials.

## `assembleForEnforcement`

```ts
import { assembleForEnforcement } from "@colibri/core";

const transaction = await assembleForEnforcement({
  transaction: baseTransaction,
  authorizedOperation,
  sorobanData: recordingSimulation.transactionData,
  resourceFee: Number(recordingSimulation.minResourceFee),
});
```

## Input

| Property              | Type                 | Required | Description |
| --------------------- | -------------------- | -------- | ----------- |
| `transaction`         | `Transaction`        | Yes      | Original base transaction |
| `authorizedOperation` | `xdr.Operation`      | Yes      | Operation containing signed auth entries |
| `sorobanData`         | `SorobanDataBuilder` | No       | Recording-simulation resources |
| `resourceFee`         | `number`             | Yes      | Recording-simulation resource fee |

## Behavior

- Returns the original transaction unchanged when the operation contains no
  delegated credentials.
- Assembles signed delegated entries with the recording-simulation resources
  when an enforcing simulation is required.
- Infers both paths from the operation XDR. There is no caller-provided flag.

## Errors

| Code      | Description |
| --------- | ----------- |
| `AFE_000` | Unexpected assembly-for-enforcement failure |
| `AFE_001` | Missing transaction |
| `AFE_002` | Missing authorized operation |
| `AFE_003` | Missing resource fee |

Typed `AssembleTransactionError` failures are preserved.
