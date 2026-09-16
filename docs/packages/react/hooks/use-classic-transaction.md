# useClassicTransaction

Submit Classic operations through Colibri’s existing Classic pipeline.

Import from `@colibri/react/transactions/classic`. Use under both
`ColibriProvider` and `QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `options?`: mutation callbacks/controls and an optional stable `pipeline`.
- Call the returned mutation with Core’s `ClassicTransactionInput`.

**Returns:** A mutation result containing the corresponding Core pipeline
output.

## Example

The parent prepares the operations and transaction configuration, including
eligible signers. The click is the explicit submission boundary.

<!-- deno-check @colibri/react -->

```tsx
import { useClassicTransaction } from "@colibri/react/transactions/classic";
import type { ClassicTransactionInput } from "@colibri/core/classic-transaction";

export function SubmitTransaction(
  { input }: { input: ClassicTransactionInput },
) {
  const transaction = useClassicTransaction();
  return (
    <section>
      <button
        disabled={transaction.isPending}
        onClick={() => transaction.mutate(input)}
      >
        Submit transaction
      </button>
      {transaction.isError && <p role="alert">{transaction.error.message}</p>}
      {transaction.isSuccess && <p>Transaction completed.</p>}
    </section>
  );
}
```

## Behavior

Input contains `operations` and the explicit Core transaction `config`,
including source, fees, timeout and signers. Keep custom pipelines stable and
configured for the provider network. Caller-installed plugins are preserved;
none are installed automatically. Automatic retries are disabled. Pending covers
the full pipeline, not separate wallet/signing/confirmation stages. Build inputs
explicitly before the user submits; see
[contract and pipeline recipes](../contracts-and-transactions.md).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/transactions/classic/~/useClassicTransaction)
