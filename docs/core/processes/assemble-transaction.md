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
  resourceFee: "25000",
});
```

Built-in pipelines propagate an explicit fee strategy automatically. Direct
callers can omit `transactionFee` to preserve the inclusion-fee component from
the incoming transaction.

## Input

| Property         | Type                                                                  | Required | Description                                                                                                   |
| ---------------- | --------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| `transaction`    | `Transaction`                                                         | Yes      | Original built transaction                                                                                    |
| `authEntries`    | `SorobanAuthorizationEntry[]`                                         | No       | Signed or unsigned authorization entries                                                                      |
| `sorobanData`    | `SorobanDataBuilder`                                                  | No       | Latest simulation footprint, limits, and resource fee                                                         |
| `transactionFee` | [`TransactionFee`](../transaction-config.md#fee-strategies)           | No       | Explicit `base`, `inclusion`, or `max` strategy                                                               |
| `resourceFee`    | `string`                                                              | No       | Overrides the resource fee embedded in the provided Soroban data                                              |
| `resources`      | [`TransactionResources`](../resources.md#choose-overrides-or-padding) | No       | Applies overrides/padding to final simulation data; mutually exclusive with the legacy `resourceFee` argument |

## Fee Assembly

Soroban transaction XDR stores a total fee and embeds the resource-fee component
in `SorobanTransactionData`. Colibri ordinarily obtains that resource component
from `sorobanData` and adds it exactly once. When `resourceFee` is provided,
Colibri clones the Soroban data and replaces only its embedded resource fee. The
override must be a non-negative integer string and cannot be lower than the
simulation-derived value.

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

The new resource policy is applied only at final assembly by the invocation
pipeline, after any enforcing simulation. It clones the data, validates the
recommendation floor and integer bounds, and then applies the existing total-fee
strategy. It never invokes the external calculator implicitly. See
[transaction resources](../resources.md) for the full policy and calculator.

The process:

1. Verifies that the input is a smart-contract transaction with an
   `invokeHostFunction` operation.
2. Rebuilds that operation with the supplied authorization entries.
3. Preserves memo, bounds, sequence constraints, and extra signers.
4. Attaches the simulation's Soroban data.
5. Produces an unsigned transaction ready for envelope signing.

## Errors

See
[every code for this context](../../reference/errors/core-processes-assemble-transaction.md)
and the [error-handling guide](../../core/error.md). Failures from lower-level
processes can retain their original context and code.
