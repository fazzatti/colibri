# AssembleTransaction

Rebuilds a Soroban transaction with signed authorization entries and the
footprint, limits, and resource fee returned by simulation.

## `assembleTransaction`

```ts
import { assembleTransaction } from "@colibri/core";

const transaction = await assembleTransaction({
  transaction: builtTransaction,
  authEntries: signedAuthEntries,
  sorobanData: simulation.transactionData,
  transactionFee: { max: "1000000" },
});
```

Built-in pipelines propagate an explicit fee strategy automatically. Direct
callers can omit `transactionFee` to preserve the inclusion-fee component from
the incoming transaction.

## Input

| Property         | Type                          | Required   | Description                                           |
| ---------------- | ----------------------------- | ---------- | ----------------------------------------------------- |
| `transaction`    | `Transaction`                 | Yes        | Original built transaction                            |
| `authEntries`    | `SorobanAuthorizationEntry[]` | No         | Signed or unsigned authorization entries              |
| `sorobanData`    | `SorobanDataBuilder`          | No         | Latest simulation footprint, limits, and resource fee |
| `transactionFee` | `TransactionFee`              | No         | Explicit `base`, `inclusion`, or `max` strategy       |
| `resourceFee`    | `number`                      | Deprecated | Ignored; resource fees are read from `sorobanData`    |

## Fee Assembly

Soroban transaction XDR stores a total fee and embeds the resource-fee component
in `SorobanTransactionData`. Colibri always obtains that resource component from
`sorobanData` and adds it exactly once.

- With no `transactionFee`, assembly subtracts any resource fee already embedded
  in the incoming transaction, preserves the remaining inclusion fee, and
  combines it with the latest simulated resources.
- `{ base: amount }` and `{ inclusion: amount }` use `amount` as the final
  inclusion-fee component. Soroban transactions contain one operation, so their
  arithmetic is the same even though the intent is distinct.
- `{ max: amount }` subtracts the latest resource fee from `amount` and uses the
  remainder as inclusion. At least 100 stroops must remain.

This calculation runs for ordinary final assembly and for the intermediate and
final assemblies used by delegated authorization. Each assembly therefore uses
the resources from its own latest simulation.

## Other Behavior

The process:

1. Verifies that the input is a smart-contract transaction with an
   `invokeHostFunction` operation.
2. Rebuilds that operation with the supplied authorization entries.
3. Preserves memo, bounds, sequence constraints, and extra signers.
4. Attaches the simulation's Soroban data.
5. Produces an unsigned transaction ready for envelope signing.

## Errors

| Code      | Description                                                   |
| --------- | ------------------------------------------------------------- |
| `ASM_001` | Missing required argument                                     |
| `ASM_002` | Not a smart-contract transaction                              |
| `ASM_003` | Unsupported operation type                                    |
| `ASM_004` | Failed to assemble the transaction                            |
| `ASM_005` | Failed to build the transaction                               |
| `ASM_006` | Failed to build Soroban data                                  |
| `ASM_007` | Fee configuration does not select exactly one mode            |
| `ASM_008` | Invalid base fee                                              |
| `ASM_009` | Invalid inclusion fee                                         |
| `ASM_010` | Invalid maximum fee                                           |
| `ASM_011` | Base fee is not positive                                      |
| `ASM_012` | Inclusion fee is below 100 stroops                            |
| `ASM_013` | Maximum cannot cover resources plus 100 stroops               |
| `ASM_014` | Final total fee exceeds the XDR limit                         |
| `ASM_015` | Incoming transaction total is below its embedded resource fee |
