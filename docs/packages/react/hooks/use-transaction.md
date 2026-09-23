# useTransaction

Look up a transaction hash through Stellar RPC.

Import from `@colibri/react/rpc`. Use under both
[`ColibriProvider`](../setup.md) and [`QueryClientProvider`](../setup.md); see
[setup](../setup.md).

## Parameters and result

- `hash`: transaction hash, or `undefined` to disable automatic fetching.
- `query?`: query controls; `enabled: false` disables automatic observation.

**Returns:** A query result containing the SDK `GetTransactionResponse`.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useTransaction } from "@colibri/react/rpc";

export function TransactionStatus({ hash }: { hash?: string }) {
  const transaction = useTransaction(hash);
  if (!hash) return <p>Supply a transaction hash.</p>;
  if (transaction.isError) {
    return <p role="alert">{transaction.error.message}</p>;
  }
  return <output>{transaction.data?.status ?? "Loading…"}</output>;
}
```

## Behavior

This is a query, not a submit operation. `NOT_FOUND` is an RPC observation, not
proof that a transaction failed. It can reflect retention limits as well as a
transaction that has not appeared yet. Polling is opt-in; use
[useWaitForTransaction](use-wait-for-transaction.md) for the default polling
policy.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/rpc/~/useTransaction)
