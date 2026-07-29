# PostAuthAssembleTransaction

Builds the intermediate transaction needed to enforce completed CAP-71
delegated credentials.

## `postAuthAssembleTransaction`

```ts
import { postAuthAssembleTransaction } from "@colibri/core";

const transaction = await postAuthAssembleTransaction({
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
| `PAA_000` | Unexpected post-auth assembly failure |
| `PAA_001` | Missing required argument |

Typed `AssembleTransactionError` failures are preserved.
