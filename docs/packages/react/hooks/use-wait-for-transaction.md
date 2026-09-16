# useWaitForTransaction

Poll a transaction hash until RPC reports a terminal status.

Import from `@colibri/react/rpc`. Use under both `ColibriProvider` and
`QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `hash`: transaction hash, or `undefined` to disable automatic fetching.
- `query?`: query controls; `enabled: false` disables automatic observation.

**Returns:** A query result containing the SDK `GetTransactionResponse`.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useWaitForTransaction } from "@colibri/react/rpc";

export function TransactionStatus({ hash }: { hash?: string }) {
  const transaction = useWaitForTransaction(hash);
  if (!hash) return <p>Supply a transaction hash.</p>;
  if (transaction.isError) {
    return <p role="alert">{transaction.error.message}</p>;
  }
  return <output>{transaction.data?.status ?? "Loading…"}</output>;
}
```

## Behavior

By default, refetch every 1,000 ms while the status is `NOT_FOUND`, then stop on
`SUCCESS` or `FAILED`. Query overrides can replace that interval. There is no
built-in deadline for `NOT_FOUND`; disable the query or unmount to stop
observing. This never submits or resubmits a transaction.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/rpc/~/useWaitForTransaction)
