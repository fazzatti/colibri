# useBalance

Read an exact XLM, Classic issued-asset or SEP-41 token balance.

Import from `@colibri/react/assets`. Use under both `ColibriProvider` and
`QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `asset`: `{ kind: "xlm" }`, `{ kind: "classic", code, issuer }`, or
  `{ kind: "sep41", contractId }`.
- `address`: G-address for Classic assets; G- or C-address for SEP-41;
  `undefined` disables automatic fetching.
- `query?`: query controls.

**Returns:** A query result containing
`{ asset, address, raw: bigint, decimals: number }`.

## Example

For XLM, pass `asset={{ kind: "xlm" }}` and a funded G-address. For a token,
pass its declared asset identity and owner.

<!-- deno-check @colibri/react -->

```tsx
import { type AssetId, useBalance } from "@colibri/react/assets";
import type { ContractId, Ed25519PublicKey } from "@colibri/react";

export function TokenBalance({ asset, address }: {
  asset: AssetId;
  address?: Ed25519PublicKey | ContractId;
}) {
  const balance = useBalance(asset, address);
  if (!address) return <p>Select a balance owner.</p>;
  if (balance.isError) return <p role="alert">{balance.error.message}</p>;
  return (
    <output>
      {balance.data
        ? `${balance.data.raw} base units (${balance.data.decimals} decimals)`
        : "Loading…"}
    </output>
  );
}
```

## Behavior

Classic amounts use seven decimals; SEP-41 decimals come from the contract.
SEP-41 includes SAC contracts as well as custom tokens. Classic paths read
ledger entries; SEP-41 paths call the token client. Missing accounts/trustlines
remain errors. Keep `raw` as bigint and format with exact arithmetic.

SEP-41 decimal precision is shared with `useTokenMetadata` in the same
QueryClient for five minutes; the balance keeps its normal query freshness.
After a known token upgrade, invalidate the scoped `token-decimals` query and
refresh affected results; see
[token precision caching](../queries.md#token-precision-caching).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/assets/~/useBalance)
