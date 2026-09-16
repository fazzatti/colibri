# useAccount

Read a Classic account’s ledger entry, including balance, thresholds and
signers.

Import from `@colibri/react/accounts`. Use under both `ColibriProvider` and
`QueryClientProvider`; see [setup](../setup.md).

## Parameters and result

- `accountId`: existing G-address, or `undefined` to disable automatic fetching.
- `query?`: query controls.

**Returns:** A query result containing Core `AccountLedgerEntry`.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { type Ed25519PublicKey, useAccount } from "@colibri/react/accounts";

export function AccountBalance(
  { accountId }: { accountId?: Ed25519PublicKey },
) {
  const account = useAccount(accountId);
  if (!accountId) return <p>Select an account.</p>;
  if (account.isError) return <p role="alert">{account.error.message}</p>;
  return (
    <output>
      {account.data ? `${account.data.balance} stroops` : "Loading…"}
    </output>
  );
}
```

## Behavior

This reads on-chain Classic account state; it does not describe a wallet
connection or create an account. A missing account remains a Core error. The
balance is a bigint amount in stroops; use [useBalance](use-balance.md) for an
explicit asset identity.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/accounts/~/useAccount)
