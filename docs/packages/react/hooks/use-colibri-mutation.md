# useColibriMutation

Run an application-owned SDK action with Colibri's mutation lifecycle,
serialization and no automatic retries.

Import from `@colibri/react/query/mutation`. Use under `ColibriQueryProvider` or
both granular providers; see [setup](../setup.md). The pure `/query` entrypoint
does not export this hook.

## Parameters and result

- `execute`: `(args: A) => Promise<T>`, the application's existing action.
- `options?`: `MutationControls<T, A>`, including success/error callbacks. The
  executor, retry policy and mutation scope cannot be overridden.

**Returns:** A TanStack mutation result with inferred input and data types,
`mutate`, `mutateAsync`, pending/error state and callbacks.

## Example

The parent supplies its existing SDK facade. Here `transfer` accepts an amount
in base units and returns a transaction hash; the facade owns validation,
authorization, submission and receipt handling.

<!-- deno-check @colibri/react -->

```tsx
import { useColibriMutation } from "@colibri/react/query/mutation";

type TransferSdk = {
  transfer(amount: bigint): Promise<{ hash: string }>;
};

export function Transfer({ sdk, amount }: {
  sdk: TransferSdk;
  amount: bigint;
}) {
  const transfer = useColibriMutation((value: bigint) => sdk.transfer(value));
  return (
    <section>
      <button
        disabled={transfer.isPending}
        onClick={() => transfer.mutate(amount)}
      >
        Transfer
      </button>
      {transfer.isError && <p role="alert">{transfer.error.message}</p>}
      {transfer.data && <output>{transfer.data.hash}</output>}
    </section>
  );
}
```

## Behavior

The executor runs only after `mutate` or `mutateAsync`. Mutations with the same
network/provider scope serialize within one QueryClient, with `retry: false`.
This does not coordinate account sequences across tabs, devices or clients.

The hook does not supply wallet authority, validate the executor's network,
infer transaction phases or recover receipts. Keep those responsibilities in the
SDK action. Handle `mutateAsync` rejections and invalidate affected queries
explicitly after success; see [queries and caching](../queries.md).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/query/mutation/~/useColibriMutation)
