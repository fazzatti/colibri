# Setup and providers

## Install

```sh
npx jsr add @colibri/react @colibri/core
npm install react@^19.1.1 react-dom@^19.1.1 @tanstack/react-query@^5.87.4
```

Use one resolved React instance throughout the application. JSR generates npm
compatibility packages; these imports are ordinary dependencies, not a promise
that JSR emits npm peer dependencies. Check `npm ls react @tanstack/react-query`
(or the corresponding pnpm command) when integrating with an existing app.

## Start with a balance

<!-- deno-check @colibri/react -->

```tsx
import { useState } from "react";
import { ColibriQueryProvider } from "@colibri/react/provider";
import { NetworkConfig } from "@colibri/core/network";
import { createColibriConfig } from "@colibri/react";
import { useBalance } from "@colibri/react/assets";

type AccountProps = { address: `G${string}` };

function Balance({ address }: AccountProps) {
  const balance = useBalance({ kind: "xlm" }, address);

  if (balance.isPending) return <p>Loading balance…</p>;
  if (balance.isError) return <p role="alert">{balance.error.message}</p>;

  return (
    <section aria-label="Stellar account balance">
      <h1>Testnet balance</h1>
      <p>{balance.data.raw.toString()} stroops</p>
      <button onClick={() => void balance.refetch()}>Refresh</button>
    </section>
  );
}

export function App({ address }: AccountProps) {
  const [config] = useState(() =>
    createColibriConfig({ network: NetworkConfig.TestNet() })
  );

  return (
    <ColibriQueryProvider config={config}>
      <Balance address={address} />
    </ColibriQueryProvider>
  );
}
```

The supplied address must be an existing, funded Testnet account. An absent
account or trustline is an error, not a fabricated zero balance. Raw amounts are
`bigint`; Classic balances have seven decimals.
[SEP-41](../../core/asset/sep-41-token-contract.md) precision comes from the
contract. Format amounts with exact integer arithmetic before displaying them.

## Configuration lifetime

Start with `ColibriQueryProvider` to supply both connection state and caching.
It owns a separate QueryClient per mounted provider and clears that owned cache
after unmount. Strict Mode effect probing preserves cached data and in-flight
queries; disposal waits until the current effect cycle finishes. Pass
`queryClient` to reuse a stable application-owned cache; the provider will not
clear it. The granular `ColibriProvider` plus `QueryClientProvider` composition
remains available.

Keep the config and any supplied QueryClient stable for one browser application.
Create fresh instances per server request. The config snapshots the network;
replace it to switch networks. Provider construction never connects or prompts a
wallet. The application owns config cleanup: call `config.destroy()` when its
lifetime ends.

Feature hooks use their own public subpaths. Query and mutation hooks need both
providers. Connection, signer observation, session observation, RPC clients and
event subscriptions need only `ColibriProvider`.
[`useContract`](hooks/use-contract.md) and
[`useIdenticon`](hooks/use-identicon.md) need neither provider; they still
follow React's rules of hooks.

See [common workflows](convenience.md), [all hooks](hooks/README.md),
[wallets and sessions](wallets-and-sessions.md), and
[queries and caching](queries.md). API references:
[ColibriQueryProvider](https://jsr.io/@colibri/react/doc/provider/~/ColibriQueryProvider),
[ColibriProvider](https://jsr.io/@colibri/react/doc/~/ColibriProvider),
[createColibriConfig](https://jsr.io/@colibri/react/doc/~/createColibriConfig).
