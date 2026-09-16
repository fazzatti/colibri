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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NetworkConfig } from "@colibri/core/network";
import { ColibriProvider, createColibriConfig } from "@colibri/react";
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
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ColibriProvider config={config}>
        <Balance address={address} />
      </ColibriProvider>
    </QueryClientProvider>
  );
}
```

The supplied address must be an existing, funded Testnet account. An absent
account or trustline is an error, not a fabricated zero balance. Raw amounts are
`bigint`; Classic balances have seven decimals. SEP-41 precision comes from the
contract. Format amounts with exact integer arithmetic before displaying them.

## Configuration lifetime

Keep the config and QueryClient stable for one browser application. Create fresh
instances per server request. The config snapshots the network; replace it to
switch networks. Provider construction never connects or prompts a wallet.

Feature hooks use their own public subpaths. Query and mutation hooks need both
providers. Connection, signer observation, session observation, RPC clients and
event subscriptions need only `ColibriProvider`. `useContract` and
`useIdenticon` need neither provider; they still follow React's rules of hooks.

See [all hooks](hooks/README.md),
[wallets and sessions](wallets-and-sessions.md), and
[queries and caching](queries.md). API references:
[ColibriProvider](https://jsr.io/@colibri/react/doc/~/ColibriProvider),
[createColibriConfig](https://jsr.io/@colibri/react/doc/~/createColibriConfig).
