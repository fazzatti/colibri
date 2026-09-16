# useTokenMetadata

Read a deployed SEP-41 contract’s name, symbol and decimal precision.

Import from `@colibri/react/assets`. Use under both `ColibriProvider` and
`QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `contractId`: a required C-address implementing SEP-41, including SAC
  contracts.
- `query?`: query controls.

**Returns:** A query result containing `{ name, symbol, decimals }`.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useTokenMetadata } from "@colibri/react/assets";
import type { ContractId } from "@colibri/react";

export function TokenLabel({ contractId }: { contractId: ContractId }) {
  const token = useTokenMetadata(contractId);
  if (token.isError) return <p role="alert">{token.error.message}</p>;
  return (
    <p>
      {token.data ? `${token.data.name} (${token.data.symbol})` : "Loading…"}
    </p>
  );
}
```

## Behavior

This queries the SEP-41 interface through Core, not a Classic code/issuer
registry. The contract must exist on the configured network and implement those
methods. The ID is required; mount the component only after it is available.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/assets/~/useTokenMetadata)
