# useLedgerEntries

Access a stable Core ledger reader for direct, known-key reads.

Import from `@colibri/react/accounts`. Requires `ColibriProvider`; see
[setup](../setup.md). No QueryClient is needed for this hook.

## Parameters and result

No parameters.

**Returns:** A memoized `LedgerEntries` instance bound to the provider RPC
client.

## Example

Supply a funded G-address on the provider network.

<!-- deno-check @colibri/react -->

```tsx
import { useState } from "react";
import {
  type Ed25519PublicKey,
  useLedgerEntries,
} from "@colibri/react/accounts";

export function LoadAccount({ accountId }: { accountId: Ed25519PublicKey }) {
  const ledger = useLedgerEntries();
  const [message, setMessage] = useState("Not requested");
  return (
    <section>
      <button
        onClick={() => {
          void ledger.account({ accountId }).then(
            (account) => setMessage(`${account.balance} stroops`),
            (error) => setMessage(String(error)),
          );
        }}
      >
        Load account
      </button>
      <output>{message}</output>
    </section>
  );
}
```

## Behavior

Calls through this reader do not automatically create cached queries. Use
[useAccount](use-account.md) or [useTrustline](use-trustline.md) for ordinary
component data, or compose your own query for other keys. See
[ledger entries](../../../core/ledger-entries.md).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/accounts/~/useLedgerEntries)
