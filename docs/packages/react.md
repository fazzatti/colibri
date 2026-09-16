# React applications

Headless React bindings for Stellar applications: connection state, cached
reads, explicit contract invocations, existing transaction pipelines, events and
SEPs.

This is the initial **0.1 preview**. React 19.1+ in the 19.x line and TanStack
Query 5.87+ in the 5.x line are supported. The app owns its configuration,
QueryClient, wallet SDKs and signing authority. Core 1.2 or later in 1.x is
required.

## Install

Follow [installation and provider setup](react/setup.md#install).

## Start with a balance

The [complete TSX balance example](react/setup.md#start-with-a-balance) mounts
both providers and displays a funded account’s balance.

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

Keep full clients and their plugins with
[useContract](react/hooks/use-contract.md), read through a generated helper or
an ABI spec, and invoke only from explicit user actions.
[Contract and pipeline recipes](react/contracts-and-transactions.md) explain
transaction configuration, simulation and event subscriptions.

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

Use one config per application and separate configs per server request.
[Queries and caching](react/queries.md) explains network scopes, freshness,
mutation retries and serialization.
[Wallets and sessions](react/wallets-and-sessions.md) explains authority
changes, memory-only credentials and cleanup. Event subscriptions have their own
[shared observer lifecycle](react/hooks/use-contract-events.md).

Connection SSR snapshots are disconnected and session SSR snapshots are
anonymous. Render ordinary query/mutation error states and handle connection
Promise rejections at the user-action boundary.
[React error codes](../reference/errors/react.md) cover integration failures;
existing Core and wallet errors retain their identity.

## Guides and API references

- [Setup and providers](react/setup.md)
- [Every React hook](react/hooks/README.md)
- [Queries and caching](react/queries.md)
- [Wallets and sessions](react/wallets-and-sessions.md)
- [Contract and pipeline recipes](react/contracts-and-transactions.md)
- [Browser imports and measurements](../getting-started/browser-bundles.md)
- [All React API modules](https://jsr.io/@colibri/react/doc)
