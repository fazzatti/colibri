# useContractRead

Query a generated client’s typed method helper through its existing read
pipeline.

Import from `@colibri/react/contracts/read`. Use under both `ColibriProvider`
and `QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `options.contract`: a client exposing contract identity and generated
  `.read()` helpers, or `undefined` while the client loads.
- `options.method`: the generated camelCase helper property.
- `options.args`: the helper’s arguments as a tuple (`[]` for an argument-free
  method).
- `options.scope?`: distinguish custom pipeline/plugin semantics.
- `options.query?`: query controls.

**Returns:** A query result whose data type is inferred from the selected
helper.

## Example

Pass your generated Counter client. The prop type below describes only the
identity and argument-free `getCount` helper used by this component; it does not
implement or replace the client.

<!-- deno-check @colibri/react -->

```tsx
import {
  type ContractIdentity,
  useContractRead,
} from "@colibri/react/contracts/read";

type CounterClient = ContractIdentity & {
  getCount: { read(): Promise<number> };
};

export function CounterValue({ contract }: { contract?: CounterClient }) {
  const count = useContractRead({ contract, method: "getCount", args: [] });
  if (!contract) return <p>Loading the contract client…</p>;
  if (count.isError) return <p role="alert">{count.error.message}</p>;
  return <output>{count.data ?? "Loading…"}</output>;
}
```

## Behavior

An undefined client disables execution, including manual refetch, through
TanStack's `skipToken`. Call the hook unconditionally and pass the real client
when it becomes available; `enabled: true` cannot override the missing-client
guard. See
[asynchronous client loading](../contracts-and-transactions.md#loading-an-existing-sdk-client-asynchronously).

The client and provider must use the same network. The public identity is
structural, so compatible Core minors do not have to share private class
members. Keys include its ID, RPC URL, SHA-256 ABI fingerprint, method,
arguments and scope. Current spec XDR is checked before a cached digest is
reused. A read simulates; it does not commit ledger state or verify deployed
Wasm. Use [contractReadQueryOptions](../queries.md) for matching
prefetch/invalidation keys. For ABI names and a loaded spec, see
[useContractReadSpec](use-contract-read-spec.md).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/contracts/read/~/useContractRead)
