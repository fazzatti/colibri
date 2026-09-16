# useContractReadSpec

Simulate a spec-described method without constructing a full Contract client.

Import from `@colibri/react/contracts/read`. Use under both `ColibriProvider`
and `QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `request`: `contractId`, loaded `spec`, exact ABI `method`, optional named
  `methodArgs`, `rpc`, `pipeline` and `scope`. The provider supplies
  `networkConfig`.
- `decode?`: observer-level decoder/validator; defaults to the Core-decoded
  value.
- `query?`: query controls excluding `select` (use `decode` instead).

**Returns:** A query result containing the decoder’s inferred result type;
`unknown` by default.

## Example

The parent supplies a deployed counter ID and its loaded spec with an
argument-free `get_count` method returning a number.

<!-- deno-check @colibri/react -->

```tsx
import {
  type ContractId,
  type Spec,
  useContractReadSpec,
} from "@colibri/react/contracts/read";

export function CounterValue(
  { contractId, spec }: { contractId: ContractId; spec: Spec },
) {
  const count = useContractReadSpec(
    { contractId, spec, method: "get_count" },
    (value) => {
      if (typeof value !== "number") {
        throw new Error(
          "Expected a numeric count",
        );
      }
      return value;
    },
  );
  if (count.isError) return <p role="alert">{count.error.message}</p>;
  return <output>{count.data ?? "Loading…"}</output>;
}
```

## Behavior

Use exact ABI names here, such as `get_count`, rather than generated camelCase
helper names. The decoder runs per observer; the cache keeps Core’s canonical
decoded result. A spec does not prove a method is read-only. Custom
RPC/pipelines must match the network; distinguish their semantics with `scope`.
Query keys use a SHA-256 ABI fingerprint. Current spec XDR is checked before
reusing a cached digest, so a changed ABI gets a different key. The fingerprint
does not verify the deployed Wasm.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/contracts/read/~/useContractReadSpec)
