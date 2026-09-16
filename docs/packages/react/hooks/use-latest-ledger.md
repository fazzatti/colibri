# useLatestLedger

Query the latest ledger observed by the configured RPC server.

Import from `@colibri/react/rpc`. Use under both `ColibriProvider` and
`QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `query?`: TanStack `QueryControls`, such as `enabled`, `staleTime` and
  `refetchInterval`.

**Returns:** A query result containing the SDK `GetLatestLedgerResponse`.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useLatestLedger } from "@colibri/react/rpc";

export function LedgerNumber() {
  const ledger = useLatestLedger({ refetchInterval: 5_000 });
  if (ledger.isError) return <p role="alert">{ledger.error.message}</p>;
  return <output>{ledger.data?.sequence ?? "Loading ledger…"}</output>;
}
```

## Behavior

Continuous polling is opt-in; this example polls every five seconds. Query keys
include the provider network and scope. Shared query controls and defaults are
described in [queries and caching](../queries.md).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/rpc/~/useLatestLedger)
