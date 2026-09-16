# useSorobanTransaction

Run the existing Soroban invocation pipeline from a component action.

Import from `@colibri/react/transactions/soroban`. Use under both
`ColibriProvider` and `QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `options?`: mutation callbacks/controls and an optional stable `pipeline`.
- Call the returned mutation with Core’s `InvokeContractInput`.

**Returns:** A mutation result containing the corresponding Core pipeline
output.

## Example

The parent prepares the operations and transaction configuration, including
eligible signers. The click is the explicit submission boundary.

<!-- deno-check @colibri/react -->

```tsx
import { useSorobanTransaction } from "@colibri/react/transactions/soroban";
import type { InvokeContractInput } from "@colibri/core/soroban-transaction";

export function SubmitTransaction({ input }: { input: InvokeContractInput }) {
  const transaction = useSorobanTransaction();
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

The input is Core’s invocation-pipeline input, including operations, transaction
configuration and any authorization settings. The pipeline builds, simulates,
authorizes, assembles, signs and submits. A custom pipeline must use the
provider network and retains its installed plugins. Automatic retries are
disabled. Pending covers the full pipeline, not separate
wallet/signing/confirmation stages. Build inputs explicitly before the user
submits; see [contract and pipeline recipes](../contracts-and-transactions.md).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/transactions/soroban/~/useSorobanTransaction)
