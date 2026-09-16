# React applications

Headless React bindings for Stellar applications: connection state, cached
reads, explicit contract invocations, existing transaction pipelines, events and
SEPs.

This is the **0.2 preview**. React 19.1+ in the 19.x line and TanStack Query
5.87+ in the 5.x line are supported. The app owns its configuration, wallet SDKs
and signing authority. `ColibriQueryProvider` can own the query cache or reuse
the application cache. Core 1.2 or later in 1.x is required.

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
`bigint`; Classic balances have seven decimals. SEP-41 precision comes from the
contract. Format amounts with exact integer arithmetic before displaying them.

See [common workflows and convenience APIs](react/convenience.md) for complete
provider, wallet and combined signing setup. Granular APIs remain available.

## Feature imports

Import runtime features from their documented subpaths. The root contains only
configuration, provider, connection hooks and integration errors. Shared type
exports are erased from JavaScript.

| Import after `@colibri/react`    | APIs                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| root                             | `createColibriConfig`, `ColibriProvider`, `useColibriConfig`, `useConnection`, `useConnect`, `useReconnect`, `useDisconnect`, `useNetwork` |
| `/rpc`                           | `useRpc`, `useLatestLedger`, `useTransaction`, `useWaitForTransaction`                                                                     |
| `/accounts`                      | `useAccount`, `useTrustline`, `useLedgerEntries`                                                                                           |
| `/assets`                        | `useBalance`, `useTokenMetadata`                                                                                                           |
| `/contracts`                     | `useContract` and its full client type                                                                                                     |
| `/contracts/read`                | `useContractRead`, `useContractReadSpec`, `contractReadQueryOptions`                                                                       |
| `/contracts/invoke`              | `useContractInvoke`                                                                                                                        |
| `/transactions/classic`          | `useClassicTransaction`                                                                                                                    |
| `/transactions/soroban`          | `useSorobanTransaction`                                                                                                                    |
| `/transactions/simulate`         | `useSimulateSorobanTransaction`                                                                                                            |
| `/query`                         | `colibriQueryKey`, `colibriQueryOptions`, `queryValue`, query/mutation controls                                                            |
| `/events`                        | `createContractEvents`, `useContractEvents`                                                                                                |
| `/webauth`                       | `useWebAuthClient`, `useWebAuth`, `useSession`, session factory                                                                            |
| `/session`                       | Framework-independent `createWebAuthSession`, `WebAuthSession`                                                                             |
| `/sep1`                          | `useStellarToml`                                                                                                                           |
| `/ecosystem/stellar-wallets-kit` | `createStellarWalletsKitConnector`                                                                                                         |
| `/ecosystem/freighter`           | `createFreighterConnector`                                                                                                                 |
| `/signers`                       | `useSigners`, `useSignMessage`, explicit connection guards                                                                                 |
| `/wallets`                       | `createWalletConnector`, `createWalletEnvelopeSigner`                                                                                      |
| `/identicon`                     | `useIdenticon`, unstyled `AccountIdenticon`                                                                                                |

## Contracts and transactions

`useContract(() => new MyGeneratedClient(...), [network, contractId])` preserves
the full subclass and its owned pipelines across normal rerenders. Keep the
factory free of network requests and use dependencies that describe its
lifetime. For an application-owned lifetime independent of React's memo cache,
create the client outside rendering and pass it directly to the read/invoke
hooks.

`useContractRead({ contract, method: "getCount", args: [] })` infers the result
from the generated method. Names are the generated camelCase properties, while
`useContractReadSpec` accepts the exact ABI name and a loaded spec. The latter
uses the standalone Core read action, which builds and simulates without
creating a full Contract class. A supplied decoder runs per observer; cached
data stays in the canonical Core representation. Reads are simulations: a spec
does not prove that a method is read-only. Simulation results do not commit
ledger state.

`useContractInvoke(contract, "increment")` preserves generated arguments,
explicit signers, decoded return values and pipeline plugins. Its `mutateAsync`
method runs only when called. `useClassicTransaction` and
`useSorobanTransaction` accept the existing pipeline input unchanged. Pass a
stable `pipeline` option to reuse a pipeline with installed plugins, including
fee bump, channel accounts or SEP-29 checks where compatible. React installs no
plugins automatically.

`useSimulateSorobanTransaction().mutateAsync(transaction)` accepts an already
built native transaction and returns Core simulation data, including resources,
authorization requirements and restoration information. It does not sign or
submit. The transaction must use the provider's network.

All mutations have automatic retries disabled and share a serial queue for the
provider's network/cache scope within one QueryClient. This reduces overlapping
local submissions; it is not a cross-tab account sequence lock. `isPending`
covers the whole Core operation. Core currently returns a hash with its terminal
result; these hooks do not invent intermediate signing/submission/confirmation
states. An ambiguous timeout must be reconciled by hash before a caller
resubmits.

After an invocation, invalidate the reads affected by that application action:
use `contractReadQueryOptions(...).queryKey` with
`queryClient.invalidateQueries`. The library cannot infer which unrelated
accounts/contracts an invocation changed.

## Stellar identities and SEPs

- XLM: `{ kind: "xlm" }`.
- Classic issued asset: `{ kind: "classic", code, issuer }`.
- SEP-41 token, including a SAC: `{ kind: "sep41", contractId }`.

Classic account/trustline reads use G-addresses. SEP-41 balances accept G or C
addresses; muxed attribution belongs to the transaction destination, not a
separate balance. A C-address does not imply an Ed25519 signing capability.

The package composes existing Colibri support: SEP-1 discovery, SEP-10/45
WebAuth, SEP-41 tokens and event values, SEP-33 SVG identicons and optional
SEP-53 message signing. SEP-1 anchor URLs are advertisements; this package does
not implement SEP-6/12/24/31/38 services. Existing Core SEP-11 asset helpers
remain available through `@colibri/core/assets` without a redundant React hook
for pure work.

## Lifetimes, errors and server rendering

Create one config and QueryClient per browser application, and fresh instances
per server request. Network configuration is snapshotted; replace the config to
change network. Connection SSR snapshots are always disconnected. The provider
never prompts, reconnects automatically, or reads browser storage during render.
`useReconnect` calls only the connector's non-prompting restore method.

`useSigners` guards capabilities before and after wallet prompts. An account or
network change invalidates retained signers. Explicit application-supplied Core
signers keep their ordinary Core behavior. Query keys include network
passphrase, provider scope, feature and canonical arguments, preserving bigint,
bytes, maps and XDR inputs. Give distinct scopes to custom
RPC/pipeline/discovery policies that can produce different results for the same
arguments.

A query key is not a cache serialization format. Core class instances and bigint
results need application-specific dehydration/rehydration. Do not JSON-stringify
an arbitrary QueryClient. WebAuth tokens are kept outside the query cache and
browser storage; `useWebAuth` returns no token through mutation data. Do not
persist/dehydrate authentication mutation variables, which contain signers.

Sessions are shared objects bound to one config and WebAuthClient. `useSession`
observes them. Disconnect, account/network changes, logout and expiration clear
the local token and invalidate pending authentication. Logout does not revoke
server-side sessions. Call `session.destroy()` when its application scope ends.
SEP-10 uses the existing WebAuth signer contract; an envelope-only browser
signer cannot be passed as a SEP-10 keypair signer. SEP-45 retains its explicit
`authorize` callback.

Create one event subscription for components that should share a stream. It
starts when the first component subscribes and stops after the last leaves. The
default window retains 100 events; failures are observable and restart is
explicit. Unsubscribe interrupts waits and ignores late events; an in-flight SDK
RPC request can still finish. Event replay remains limited by RPC retention.

`ColibriReactError` adds stable `REACT_*` codes. Existing Colibri, wallet and
TanStack errors keep their identity. Render errors using the ordinary query and
mutation results; handle `connect()` rejection at the user-action boundary.

## Guides and API references

- [Wallets and sessions](react/wallets-and-sessions.md)
- [Contract and pipeline recipes](react/contracts-and-transactions.md)
- [Browser imports and measurements](../getting-started/browser-bundles.md)
- [All React API modules](https://jsr.io/@colibri/react/doc)

Ecosystem conveniences have separate imports:
[Wallets Kit and Freighter](react/wallets-and-sessions.md). SDK types are
upstream-derived; the application loads and initializes wallet runtimes.
