# @colibri/react

React hooks and components for Stellar applications, built on Colibri's clients,
signers and transaction pipelines. Read account and token data, retain full
contract clients, invoke contracts, submit Classic transactions, and observe
wallets, sessions and events through React.

**0.2 preview** · Core **1.2+** within 1.x · React **19.1+** within 19.x ·
TanStack Query **5.87+** within 5.x.

## Contents

- [Installation](#installation)
- [Quick start](#quick-start)
- [API by import path](#api-by-import-path)
- [Configuration and connection](#configuration-and-connection)
- [RPC, accounts and assets](#rpc-accounts-and-assets)
- [Contracts](#contracts)
- [Transactions and simulation](#transactions-and-simulation)
- [Wallets and signers](#wallets-and-signers)
- [Discovery, authentication and sessions](#discovery-authentication-and-sessions)
- [Contract events](#contract-events)
- [Identicons](#identicons)
- [Query utilities](#query-utilities)
- [Errors and application lifetimes](#errors-and-application-lifetimes)
- [Guides and full API reference](#guides-and-full-api-reference)

## Installation

In your React application:

```sh
npx jsr add @colibri/react @colibri/core
npm install react@^19.1.1 react-dom@^19.1.1 @tanstack/react-query@^5.87.4
npm install --save-dev @types/react @types/react-dom
```

Use your application's TSX tooling, with the automatic React JSX transform
(`"jsx": "react-jsx"` in TypeScript). Keep a single resolved React instance
across the app and its libraries. JSR's npm packages use ordinary dependencies;
check `npm ls react @tanstack/react-query` when adding Colibri to an existing
app.

Your application loads its chosen wallet SDK and initializes its modules. The
ecosystem adapters use upstream type dependencies but do not import or
initialize wallet runtimes. All integrations remain in this React package.

## Quick start

Save this as `App.tsx` and render `<App address={fundedTestnetAddress} />` from
your application. Supply the full G-address of an existing Testnet account.

<!-- deno-check -->

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

`ColibriQueryProvider` supplies the network, connection state and an isolated
query cache. Strict Mode effect probing preserves its data and active queries;
the owned cache is cleared after a real unmount. Pass `queryClient` to reuse an
existing application cache, which the provider never clears. The granular
`ColibriProvider` plus `QueryClientProvider` composition remains available.
Reading a public balance does not require connecting a wallet.

`raw` is a `bigint`: XLM and Classic balances have seven decimal places, so
10,000,000 stroops equals 1 XLM. SEP-41 precision comes from the token contract.
Use exact integer formatting when displaying decimal amounts. Missing accounts
or trustlines surface Core's structured error instead of a fabricated zero.

## Common workflows first

| Common task                                                    | Convenience API                                                            | Granular alternative                                    |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------- |
| Provide state and caching                                      | `ColibriQueryProvider` from `/provider`                                    | `ColibriProvider` plus `QueryClientProvider`            |
| Observe and control a wallet                                   | `useWallet` from `/wallet`                                                 | `useConnection`, connect/disconnect hooks, `useSigners` |
| Sign envelopes and Soroban authorization                       | `createWalletSigner` from `/wallets/signer`                                | Envelope and auth-entry factories                       |
| Invoke with the connected wallet                               | `useWalletContractInvoke` from `/contracts/invoke`                         | `useContractInvoke` with explicit config                |
| Read accounts, balances, contracts or metadata                 | Existing `useAccount`, `useBalance`, `useContractRead`, `useTokenMetadata` | Core clients and query options                          |
| Execute or simulate transactions, authenticate, observe events | Existing transaction hooks, `useWebAuth`, `useContractEvents`              | Core pipelines, WebAuth sessions and event stores       |

Conveniences compose these same primitives. They do not introduce another cache,
client or submission path. Import only the feature subpaths needed by the app.
See the
[complete convenience guide](https://github.com/fazzatti/colibri/blob/dev/docs/packages/react/convenience.md).

## API by import path

The root exports configuration, connection hooks and errors. Import other
features from their public subpaths; this lets bundlers discard unused runtime
code. Subpaths are part of the same package.

| Import                                         | Runtime API                                                                                                                                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@colibri/react`                               | `ColibriConfig`, `createColibriConfig`, `ColibriProvider`, `useColibriConfig`, `useConnection`, `useConnect`, `useReconnect`, `useDisconnect`, `useNetwork`, `ColibriReactError`, `ReactCode` |
| `@colibri/react/rpc`                           | `useRpc`, `useLatestLedger`, `useTransaction`, `useWaitForTransaction`                                                                                                                        |
| `@colibri/react/accounts`                      | `useLedgerEntries`, `useAccount`, `useTrustline`                                                                                                                                              |
| `@colibri/react/assets`                        | `useBalance`, `useTokenMetadata`                                                                                                                                                              |
| `@colibri/react/contracts`                     | `useContract`                                                                                                                                                                                 |
| `@colibri/react/contracts/read`                | `useContractRead`, `useContractReadSpec`, `contractReadQueryOptions`                                                                                                                          |
| `@colibri/react/contracts/invoke`              | `useContractInvoke`                                                                                                                                                                           |
| `@colibri/react/transactions/classic`          | `useClassicTransaction`                                                                                                                                                                       |
| `@colibri/react/transactions/soroban`          | `useSorobanTransaction`                                                                                                                                                                       |
| `@colibri/react/transactions/simulate`         | `useSimulateSorobanTransaction`                                                                                                                                                               |
| `@colibri/react/wallets`                       | `createWalletConnector`, `createWalletEnvelopeSigner`                                                                                                                                         |
| `@colibri/react/ecosystem/stellar-wallets-kit` | `createStellarWalletsKitConnector`                                                                                                                                                            |
| `@colibri/react/ecosystem/freighter`           | `createFreighterConnector`                                                                                                                                                                    |
| `@colibri/react/signers`                       | `useSigners`, `useSignMessage`, `guardedSigners`, `assertConnection`                                                                                                                          |
| `@colibri/react/sep1`                          | `useStellarToml`                                                                                                                                                                              |
| `@colibri/react/webauth`                       | `useWebAuthClient`, `useWebAuth`, `useSession`, `createWebAuthSession`, `WebAuthSession`                                                                                                      |
| `@colibri/react/session`                       | `createWebAuthSession`, `WebAuthSession` (framework-independent)                                                                                                                              |
| `@colibri/react/events`                        | `createContractEvents`, `ContractEventsSubscription`, `useContractEvents`                                                                                                                     |
| `@colibri/react/identicon`                     | `useIdenticon`, `AccountIdenticon`                                                                                                                                                            |
| `@colibri/react/query`                         | `colibriQueryKey`, `colibriQueryOptions`, `queryValue`                                                                                                                                        |

Query hooks return TanStack `UseQueryResult`: inspect `data`, `error`,
`isPending`, `isError`, `isFetching`, and call `refetch()` when needed. Mutation
hooks return `UseMutationResult`, including `mutate`, `mutateAsync`,
`isPending`, `data`, `error` and `reset`. Connection actions return functions
and Promises; they are not mutation-result objects.

Each feature also exports its public options/results and supporting types. The
sections below describe the primary contracts; the linked JSR references contain
full generic signatures and inherited Core types.

## Configuration and connection

Import from `@colibri/react`. [Reference](https://jsr.io/@colibri/react/doc).

| API                                 | Inputs and result                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `createColibriConfig(options)`      | Returns a `ColibriConfig`. Requires `network: NetworkConfig`; accepts `connectors?: readonly WalletConnector[]` and `scope?: string`.         |
| `<ColibriProvider config={config}>` | Provides a stable config to descendants; accepts React `children`.                                                                            |
| `useColibriConfig()`                | Returns the provider's exact config instance.                                                                                                 |
| `useNetwork()`                      | Returns its immutable network snapshot. Replace the config to change networks.                                                                |
| `useConnection()`                   | Returns `ConnectionState`: `status`, optional `connectorId`, `connection` and `error`. Status is `disconnected`, `connecting` or `connected`. |
| `useConnect()`                      | Returns `(connectorId) => Promise<WalletConnection \| null>`. Call from a user action.                                                        |
| `useReconnect()`                    | Returns the same function shape, calling only the connector's non-prompting `reconnect`. Returns `null` when restoration is unavailable.      |
| `useDisconnect()`                   | Returns `() => Promise<void>`. Clears local authority before awaiting external wallet cleanup.                                                |

`ColibriConfig` also exposes `connect(id, reconnect?)`, `disconnect()`,
`getSnapshot()`, `getServerSnapshot()`, `subscribe(listener)` and `destroy()`
for code outside React. `subscribe` returns an unsubscribe function. `destroy`
releases local listeners; use `disconnect` when asking the external wallet to
end its session. Its `network`, `connectors` and `scope` are readonly.

A connected `WalletConnection` contains `address`, the wallet's actual
`networkPassphrase`, explicitly configured `signers`, and an optional
`messageSigner`. The provider rejects a wallet connected to a different network.
A disconnect notification (`null`) or network mismatch releases the wallet
subscription and ignores later events from it. Restoring the connection requires
an explicit `useConnect` or `useReconnect` call.

This component can be placed below `ColibriProvider`. Its `connectorId` must
identify a connector supplied to `createColibriConfig`.

<!-- deno-check -->

```tsx
import { useState } from "react";
import { useConnect, useConnection, useDisconnect } from "@colibri/react";

export function WalletButton({ connectorId }: { connectorId: string }) {
  const state = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const [error, setError] = useState<string>();

  async function toggleConnection() {
    setError(undefined);
    try {
      if (state.status === "connected") await disconnect();
      else await connect(connectorId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <div>
      <button
        disabled={state.status === "connecting"}
        onClick={() => void toggleConnection()}
      >
        {state.status === "connected" ? "Disconnect wallet" : "Connect wallet"}
      </button>
      {state.connection && <p>{state.connection.address}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

## RPC, accounts and assets

### RPC — `@colibri/react/rpc`

[Reference](https://jsr.io/@colibri/react/doc/rpc).

- `useRpc()` returns a memoized native Stellar RPC `Server` for the configured
  endpoint. The network must have an RPC URL.
- `useLatestLedger(query?)` queries the latest ledger. Polling is opt-in with
  `query.refetchInterval`.
- `useTransaction(hash, query?)` reads a transaction response; an undefined hash
  disables the query.
- `useWaitForTransaction(hash, query?)` polls every 1,000 ms until the
  response's status differs from `NOT_FOUND`. Query options can override the
  interval. Unmount or set `enabled: false` to stop. `NOT_FOUND` is an
  observation; there is no automatic expiry, submission or resubmission.

### Accounts — `@colibri/react/accounts`

[Reference](https://jsr.io/@colibri/react/doc/accounts).

- `useLedgerEntries()` returns a stable Core `LedgerEntries` reader for advanced
  known-key access.
- `useAccount(accountId, query?)` returns `AccountLedgerEntry`, including the
  Classic balance, thresholds and signers. Supply a G-address; undefined
  disables the query.
- `useTrustline(args, query?)` accepts Core `BuildTrustlineLedgerKeyArgs` and
  returns `TrustlineLedgerEntry`. For an issued asset, pass
  `{ accountId, asset: new Asset(code, issuer) }`; the `asset` field also
  accepts Core's supported liquidity-pool share representations. Undefined
  disables the query.

### Assets — `@colibri/react/assets`

[Reference](https://jsr.io/@colibri/react/doc/assets).

`useBalance(asset, address, query?)` returns a `Balance` with
`{ asset, address, raw: bigint, decimals: number }`.

| `AssetId`                           | Address and source                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------- |
| `{ kind: "xlm" }`                   | G-address; Classic account entry.                                                |
| `{ kind: "classic", code, issuer }` | G-address; Classic trustline for that code/issuer.                               |
| `{ kind: "sep41", contractId }`     | G- or C-address; SEP-41 `balance` and `decimals` calls, including SAC contracts. |

An undefined address disables the balance query. Muxed attribution belongs to a
transaction destination, not a separate balance. A C-address alone establishes
no Ed25519 signing capability.

`useTokenMetadata(contractId, query?)` returns
`{ name: string, symbol: string, decimals: number }` from a SEP-41 token or SAC.

## Contracts

### Full clients — `@colibri/react/contracts`

`useContract(factory, dependencies)` returns the exact `Contract` subclass
created by the factory, preserving its methods and owned pipelines across normal
rerenders. The factory must be free of network requests; dependencies describe
its network, contract identity and configuration. For a lifetime independent of
React's memo cache, own the client outside rendering and pass it to the hooks.
[Reference](https://jsr.io/@colibri/react/doc/contracts).

### Reads — `@colibri/react/contracts/read`

[Reference](https://jsr.io/@colibri/react/doc/contracts/read).

- `useContractRead({ contract, method, args, scope?, query? })` calls a
  generated helper's `read(...args)` through its existing pipeline. `method` is
  the generated camelCase property; `args` is the inferred argument tuple and
  the result type follows the generated method.
- `contractReadQueryOptions(config, options)` returns those same query options
  for prefetching, cache access and precise invalidation outside the hook.
- `useContractReadSpec(request, decode?, query?)` accepts
  `{ contractId, spec, method, methodArgs?, rpc?, pipeline?, scope? }`. Here,
  `method` is the exact ABI name and `methodArgs` is the named argument object.
  It uses the standalone Core read pipeline. The result is `unknown` unless
  narrowed by a decoder; the decoder runs per observer over cached Core data.

Give custom RPC/pipeline policies distinct scopes when they can produce
different results for identical arguments. Contract reads are simulations;
method names/specs do not prove read-only behavior, and simulation does not
commit ledger changes.

### Invocations — `@colibri/react/contracts/invoke`

`useContractInvoke(contract, method, mutationOptions?)` returns a mutation whose
input and output come from the generated helper's `invoke` signature. Calling
`mutateAsync(input)` preserves explicit signers, pipeline plugins, transaction
metadata and the decoded return value. It validates the client's network against
the provider. [Reference](https://jsr.io/@colibri/react/doc/contracts/invoke).

For a generated `counter` client with `getCount` and `increment` methods, the
following **application fragment** illustrates composition. `Counter` is your
generated class and `input` is the complete, explicitly signed invocation input
for its `increment.invoke` method.

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { useColibriConfig } from "@colibri/react";
import {
  contractReadQueryOptions,
  useContractRead,
} from "@colibri/react/contracts/read";
import { useContractInvoke } from "@colibri/react/contracts/invoke";
import type { Counter } from "./contracts/counter";

function CounterPanel({ counter, input }: {
  counter: Counter;
  input: Parameters<Counter["increment"]["invoke"]>[0];
}) {
  const config = useColibriConfig();
  const queryClient = useQueryClient();
  const options = {
    contract: counter,
    method: "getCount" as const,
    args: [] as [],
  };
  const count = useContractRead(options);
  const increment = useContractInvoke(counter, "increment", {
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: contractReadQueryOptions(config, options).queryKey,
      }),
  });

  return (
    <section>
      <p>Count: {count.data?.toString() ?? "Loading…"}</p>
      <button
        disabled={increment.isPending}
        onClick={() => increment.mutate(input)}
      >
        Increment
      </button>
      {increment.isError && <p role="alert">{increment.error.message}</p>}
    </section>
  );
}
```

The
[contract guide](https://github.com/fazzatti/colibri/blob/dev/docs/packages/react/contracts-and-transactions.md)
contains the full client/pipeline setup. Invalidation is explicit because a
contract invocation can affect data outside that contract's own queries.

## Transactions and simulation

| Hook / import                                                           | `mutateAsync` input → result                                         |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `useClassicTransaction(options?)` from `/transactions/classic`          | Core `ClassicTransactionInput` → `ClassicTransactionOutput`.         |
| `useSorobanTransaction(options?)` from `/transactions/soroban`          | Core `InvokeContractInput` → `InvokeContractOutput`.                 |
| `useSimulateSorobanTransaction(options?)` from `/transactions/simulate` | Already-built native transaction → Core `SimulateTransactionOutput`. |

The first two hooks build the existing pipeline from the provider's network and
RPC client. Their options accept a stable `pipeline` instance alongside mutation
callbacks. Attach fee-bump, channel-account or SEP-29 plugins to that pipeline
where compatible, then pass the original callable instance. Invocation inputs,
fee units and parsed outputs keep their Core meanings.

Simulation checks the transaction's network and returns resources, authorization
requirements and restoration information without signing or submission. To
simulate an already-built transaction from an application button:

<!-- deno-check -->

```tsx
import { useSimulateSorobanTransaction } from "@colibri/react/transactions/simulate";
import type { SimulateTransactionInput } from "@colibri/core/simulation";

export function SimulateButton({ transaction }: {
  transaction: SimulateTransactionInput["transaction"];
}) {
  const simulation = useSimulateSorobanTransaction();

  return (
    <div>
      <button
        disabled={simulation.isPending}
        onClick={() => simulation.mutate(transaction)}
      >
        Simulate transaction
      </button>
      {simulation.isSuccess && <p>Simulation completed</p>}
      {simulation.isError && <p role="alert">{simulation.error.message}</p>}
    </div>
  );
}
```

All mutations disable automatic retries and share a serial queue for the
provider's network/scope within one QueryClient. This reduces overlapping local
submissions; it is not a cross-tab sequence lock. `isPending` covers the whole
Core operation. Core returns its transaction hash with the terminal result;
these hooks do not expose intermediate signing/submission stages. Reconcile an
ambiguous result before deciding whether to resubmit.

References: [Classic](https://jsr.io/@colibri/react/doc/transactions/classic),
[Soroban](https://jsr.io/@colibri/react/doc/transactions/soroban),
[simulation](https://jsr.io/@colibri/react/doc/transactions/simulate).

## Wallets and signers

### Wallet adapters — `@colibri/react/wallets`

- `createWalletConnector(connector)` snapshots an app-owned `WalletConnector`.
  The contract requires `id` and `connect()`, with optional non-prompting
  `reconnect()`, `disconnect()` and `subscribe(listener)`. Subscriptions return
  cleanup and emit a `WalletConnection` or `null` on disconnect.
- `createWalletEnvelopeSigner(options)` bridges signed transaction XDR into a
  Core `EnvelopeSigner`. Supply the actual `publicKey`, `networkPassphrase`,
  optional controlled `accounts`, and
  `signTransaction(xdr, networkPassphrase): Promise<string>`.

### Ecosystem adapters

Import `createStellarWalletsKitConnector` from
`@colibri/react/ecosystem/stellar-wallets-kit`. Pass the application's
initialized Wallets Kit and required
`capabilities({ module, address, networkPassphrase })`. The callback returns
`{ signer?, envelope?, authEntry?, signers?, messageSigner? }`: only explicitly
selected capabilities are exposed. For a G-account wallet supporting both
signing forms, return `{ signer: createWalletSigner }`, importing the factory
from `/wallets/signer`. This creates one guarded Core signer with both methods.
Declare capabilities per module; the presence of an SDK method does not prove
wallet support. Do not combine `signer` with `envelope` or `authEntry`. The
separate `envelope: true` option adapts only transaction signing. Other Core
signers and SEP-53 message signers are application supplied. Optional `id`
defaults to `stellar-wallets-kit`; `connect` can supply custom UI in place of
the Kit's `authModal()`.

The application chooses wallet modules and initializes the Kit in the browser.
Kit state changes, module changes and disconnect events invalidate the
connection. After a state change, call `useReconnect` explicitly to read the
cached account and network again without opening UI. An explicit Connect is
required after a module switch because Kit can retain an earlier wallet's cached
address. Silent reconnect uses cached Kit identity without opening UI. Envelope
signing checks account/module/network around the request; Colibri pipelines own
submission.

For direct Freighter, import `createFreighterConnector(api, options?)` from
`@colibri/react/ecosystem/freighter`. `id` defaults to `freighter` and
`pollIntervalMs` to 2,000. It provides envelope signing and observes authorized
account/network state; cleanup stops polling. Auth-entry and message
capabilities require their own explicit adapters.

Both SDK interfaces are derived from published upstream types: Wallets Kit 2.6+
within 2.x and Freighter API 6.0.1+ within 6.x. The adapters do not import SDK
runtimes; the app supplies them. Their type/install dependencies belong to the
existing React package. General helpers remain separate under `/wallets`. See
the
[complete WalletApp.tsx and configuration recipes](https://github.com/fazzatti/colibri/blob/dev/docs/packages/react/wallets-and-sessions.md).

### Signing — `@colibri/react/signers`

- `useSigners()` returns the connection's `readonly Signer[]`, guarded before
  and after signing prompts. It returns an empty array while disconnected.
- `useSignMessage(options?)` returns a mutation accepting `string | Uint8Array`
  and producing signature bytes. Requires the connector's SEP-53 message signer.
- `guardedSigners(config, connection)` builds those guards outside React.
- `assertConnection(config, connection)` rejects capabilities retained from an
  earlier account, network or connection state.

Envelope signing, Soroban authorization entries, preauthorized transactions and
message signing are distinct capabilities. Hooks preserve the ones configured by
the connector; a wallet name or address does not imply all of them. Explicit
Core signers supplied by the application retain their ordinary Core behavior.

See
[wallet recipes](https://github.com/fazzatti/colibri/blob/dev/docs/packages/react/wallets-and-sessions.md),
[generic wallet API](https://jsr.io/@colibri/react/doc/wallets),
[Wallets Kit API](https://jsr.io/@colibri/react/doc/ecosystem/stellar-wallets-kit),
[Freighter API](https://jsr.io/@colibri/react/doc/ecosystem/freighter) and
[signer API](https://jsr.io/@colibri/react/doc/signers).

## Discovery, authentication and sessions

| API                                                                  | Inputs and result                                                                                                   |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `useStellarToml(domain, options?, query?, scope?)` from `/sep1`      | Queries a validated Core `StellarToml`; undefined domain disables the query. Options are Core `StellarTomlOptions`. |
| `useWebAuthClient(domain, options?, query?, scope?)` from `/webauth` | Discovers a unified SEP-10/45 `WebAuthClient` for the provider's network. Undefined domain disables the query.      |
| `createWebAuthSession(config, client)` from `/session` or `/webauth` | Creates one shared, memory-only `WebAuthSession`.                                                                   |
| `useSession(session)` from `/webauth`                                | Returns `SessionState`: `anonymous`, `authenticating` or `authenticated`, with an optional `WebAuthToken`.          |
| `useWebAuth(session, mutationOptions?)` from `/webauth`              | Explicit authentication mutation accepting Core WebAuth's `WebAuthAuthenticationOptions`; mutation data is `void`.  |

Both discovery hooks default their extra scope to `default`. Choose a distinct
scope for custom fetchers/discovery policies. SEP-1 advertises anchor endpoints;
it does not implement the advertised SEP-6/12/24/31/38 services.

Own a session outside rendering and pass the same instance to its consumers.
`WebAuthSession` exposes `authenticate(options): Promise<WebAuthToken>`,
`logout()`, `destroy()`, `getSnapshot()`, `getServerSnapshot()` and
`subscribe(listener)`. Subscription cleanup removes the observer. Destroy the
session when its application/request scope ends.

Tokens stay in the session, outside query data and browser storage. Disconnect,
account/network changes, expiry and logout clear them and invalidate pending
authentication. Logout does not revoke a server-side session. Authentication
mutation variables contain signers and must not be persisted/dehydrated. SEP-10
retains WebAuth's signer contract; an envelope-only adapter is insufficient.
SEP-45 retains the explicit `authorize` callback.

See the
[authentication recipes](https://github.com/fazzatti/colibri/blob/dev/docs/packages/react/wallets-and-sessions.md)
and references for [SEP-1](https://jsr.io/@colibri/react/doc/sep1),
[WebAuth](https://jsr.io/@colibri/react/doc/webauth) and
[sessions](https://jsr.io/@colibri/react/doc/session).

## Contract events

`createContractEvents(config, options?)` returns a `ContractEventsSubscription`.
Options are `filters?: EventFilter[]`, `startLedger?`, `stopLedger?`,
`maxEvents?` (default 100) and RPCStreamer `streaming?` controls. Omitting the
starting ledger starts at the latest ledger; history is limited by RPC
retention.

`useContractEvents(subscription)` observes its
`{ status, events: readonly Event[], error? }`. Status is `idle`, `streaming`,
`complete` or `error`. Share one subscription to share one stream: the first
observer starts it and the last cleanup stops it. `restart()` explicitly retries
with the configured ledger range, deduplicating the retained event window.
`getSnapshot()`, `getServerSnapshot()` and `subscribe(listener)` expose the same
store outside React; `subscribe` returns cleanup. `destroy()` releases
observers. An in-flight SDK RPC call can still finish after unsubscribe; late
results are ignored.

Both APIs and the class are exported from `@colibri/react/events`.
[Reference](https://jsr.io/@colibri/react/doc/events).

## Identicons

`useIdenticon(address, options?)` returns an SVG data URL, or undefined for an
undefined address. `AccountIdenticon` renders an unstyled `<img>` and accepts
`address`, required `alt`, optional `className`, and `IdenticonOptions`: `size`,
`padding`, `background`, `saturation` and `value`. It supports SEP-33
G-addresses and Colibri's C-address extension.

<!-- deno-check -->

```tsx
import { AccountIdenticon } from "@colibri/react/identicon";

export function AccountBadge({ address }: { address: string }) {
  return (
    <span>
      <AccountIdenticon address={address} alt="" size={32} />
      <span>{address}</span>
    </span>
  );
}
```

The empty `alt` marks the image as decorative alongside the visible address.
This optional component needs no provider and imports the SVG renderer.
[Reference](https://jsr.io/@colibri/react/doc/identicon).

## Query utilities

Import from `@colibri/react/query`. These helpers can also be used outside
React. [Reference](https://jsr.io/@colibri/react/doc/query).

- `colibriQueryKey(config, feature, input)` constructs a key containing network
  passphrase, provider scope, feature and canonical input.
- `colibriQueryOptions(config, feature, input, queryFn, controls?)` supplies
  that key/executor and a default `staleTime` of 10,000 ms.
- `queryValue(input)` creates the canonical, JSON-safe key representation for
  plain values, bigint, bytes, maps and XDR values. Cycles and unsupported
  objects fail with `REACT_005`.
- `QueryControls<T>` exposes TanStack query policy without replacing the key,
  executor or hash function. `MutationControls<T, Args>` exposes mutation
  callbacks while preserving the package's executor, retry and queue policies.

Use returned keys for prefetching and `queryClient.invalidateQueries`. A key
serializer is not a result serializer: bigint and Core class instances require
application-specific dehydration/rehydration. Scope caches per server request;
never share authenticated application state between users.

## Errors and application lifetimes

Each React failure has a dedicated class, such as `ReactNetworkMismatchError`,
which extends `ColibriReactError` and Core `ColibriError`. Use `instanceof` or
branch on the stable `error.code` rather than message text. `ReactCode` names
the package's stable conditions:

| Code        | Condition                                                       |
| ----------- | --------------------------------------------------------------- |
| `REACT_001` | Missing Colibri provider.                                       |
| `REACT_002` | Invalid config, adapter options or mismatched object ownership. |
| `REACT_003` | Required signing capability unavailable.                        |
| `REACT_004` | Wallet connection changed or became unavailable.                |
| `REACT_005` | Query input cannot be represented as a canonical key.           |
| `REACT_006` | Generated contract helper unavailable.                          |
| `REACT_007` | Network mismatch.                                               |
| `REACT_008` | Authentication result invalid for the session.                  |

Underlying Core, wallet and TanStack failures retain their identity. Use query
and mutation errors in the UI, and handle rejection from explicit connection
functions.
[Error reference](https://github.com/fazzatti/colibri/blob/dev/docs/reference/errors/react.md).

Keep config, QueryClient, contract clients, sessions and event subscriptions
stable for their intended lifetime. Construct fresh application state per SSR
request. Connection/server snapshots begin disconnected, sessions begin
anonymous, and event streams begin idle. Provider rendering does not prompt for
wallet access; reconnect is explicit. Dispose application-owned sessions,
subscriptions and configs when their scope ends.

## Guides and full API reference

- [React application guide](https://github.com/fazzatti/colibri/blob/dev/docs/packages/react.md)
- [Wallets, capabilities and sessions](https://github.com/fazzatti/colibri/blob/dev/docs/packages/react/wallets-and-sessions.md)
- [Contract clients, invocation and pipeline recipes](https://github.com/fazzatti/colibri/blob/dev/docs/packages/react/contracts-and-transactions.md)
- [Frontend imports and bundle measurements](https://github.com/fazzatti/colibri/blob/dev/docs/getting-started/browser-bundles.md)
- [Complete React API reference](https://jsr.io/@colibri/react/doc)

## Consumer migration additions in 0.2

`useContractRead` accepts `contract: undefined` while an application loads an
ABI or configures plugins. It remains disabled, including manual refetch, until
the real client is provided. Clients use a structural public identity, so a
compatible older Core minor does not fail because of private class members.
Argument/result inference and the client's existing pipelines remain intact.
Query keys contain a SHA-256 ABI fingerprint. Current XDR is checked before a
cached digest is reused, so replacing or changing a spec invalidates its key.

`useBalance` and `useTokenMetadata` share SEP-41 decimal precision in the same
QueryClient for five minutes. The balance itself retains its normal freshness.
Invalidate the network-scoped `token-decimals` query after a known token
upgrade.

`createWalletAuthEntrySigner` from `/wallets/auth-entry` adapts an explicitly
supported G-account wallet capability. Wallets Kit can opt in using
`authEntry: createWalletAuthEntrySigner`, independently of `envelope: true`.
Returned authorizations must preserve the requested account, nonce, invocation
and expiry. See the wallet guide for the complete workflow.

`useColibriMutation` is exported from `/query/mutation` for application-owned
SDK facades and compound actions. It retains Colibri's network-scoped
serialization and never retries automatically. It does not infer transaction
phases or replace a facade's validation, signing, submission or receipt
handling.
