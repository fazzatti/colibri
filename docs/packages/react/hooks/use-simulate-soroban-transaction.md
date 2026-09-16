# useSimulateSorobanTransaction

Simulate a prepared native Soroban transaction without signing or submitting it.

Import from `@colibri/react/transactions/simulate`. Use under both
`ColibriProvider` and `QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `options?`: mutation callbacks and controls.
- Call the returned mutation with `SimulateTransactionInput["transaction"]`.

**Returns:** A mutation result containing the full Core
`SimulateTransactionOutput`.

## Example

Pass an already built native transaction on the configured network.

<!-- deno-check @colibri/react -->

```tsx
import { useSimulateSorobanTransaction } from "@colibri/react/transactions/simulate";
import type { SimulateTransactionInput } from "@colibri/core/simulation";

export function PreviewTransaction(
  { transaction }: { transaction: SimulateTransactionInput["transaction"] },
) {
  const simulation = useSimulateSorobanTransaction();
  return (
    <section>
      <button
        disabled={simulation.isPending}
        onClick={() => simulation.mutate(transaction)}
      >
        Simulate
      </button>
      {simulation.isError && <p role="alert">{simulation.error.message}</p>}
      {simulation.isSuccess && <p>Simulation ready for inspection.</p>}
    </section>
  );
}
```

## Behavior

The transaction’s network passphrase must match the provider. Results retain
resource, authorization and restoration information from Core. A successful
simulation does not guarantee that a later submission succeeds; submission
requires an explicit separate action.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/transactions/simulate/~/useSimulateSorobanTransaction)
