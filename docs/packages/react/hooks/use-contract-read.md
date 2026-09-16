# useContractRead

Query a generated client’s typed method helper through its existing read
pipeline.

Import from `@colibri/react/contracts/read`. Use under both `ColibriProvider`
and `QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `options.contract`: a client exposing contract identity and generated
  `.read()` helpers.
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

export function CounterValue({ contract }: { contract: CounterClient }) {
  const count = useContractRead({ contract, method: "getCount", args: [] });
  if (count.isError) return <p role="alert">{count.error.message}</p>;
  return <output>{count.data ?? "Loading…"}</output>;
}
```

## Behavior

The client and provider must use the same network. Keys include its ID, RPC URL,
embedded spec, method, arguments and scope. A read simulates; it does not commit
ledger state. Use [contractReadQueryOptions](../queries.md) for matching
prefetch/invalidation keys. For ABI names and a loaded spec, see
[useContractReadSpec](use-contract-read-spec.md).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/contracts/read/~/useContractRead)
