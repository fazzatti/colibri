# useTrustline

Read a Classic trustline’s balance and ledger metadata.

Import from `@colibri/react/accounts`. Use under both `ColibriProvider` and
`QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `args`: Core `BuildTrustlineLedgerKeyArgs`, or `undefined` to disable
  automatic fetching.
- `query?`: query controls.

**Returns:** A query result containing Core `TrustlineLedgerEntry`.

## Example

Supply the trustline owner and the complete asset identity from your
application.

<!-- deno-check @colibri/react -->

```tsx
import { Asset } from "@colibri/core/ledger";
import { type Ed25519PublicKey, useTrustline } from "@colibri/react/accounts";

export function IssuedBalance({ accountId, code, issuer }: {
  accountId: Ed25519PublicKey;
  code: string;
  issuer: Ed25519PublicKey;
}) {
  const trustline = useTrustline({ accountId, asset: new Asset(code, issuer) });
  if (trustline.isError) return <p role="alert">{trustline.error.message}</p>;
  return <output>{trustline.data?.balance.toString() ?? "Loading…"}</output>;
}
```

## Behavior

Use a Classic issued asset’s code and issuer. XLM has no trustline; use
[useAccount](use-account.md) or [useBalance](use-balance.md) instead. A missing
trustline is an error, not a zero balance. Query keys use the asset’s canonical
string.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/accounts/~/useTrustline)
