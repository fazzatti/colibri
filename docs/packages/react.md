# React applications

Headless React bindings for Stellar applications: connection state, cached
reads, explicit contract invocations, existing transaction pipelines, events and
SEPs.

The React package is a [0.x preview](../getting-started/compatibility.md). React
19.1+ in the 19.x line and TanStack Query 5.87+ in the 5.x line are supported.
The app owns its configuration, wallet SDKs and signing authority.
[`ColibriQueryProvider`](react/setup.md) can own the query cache or reuse the
application cache. See [installation](../getting-started/installation.md) for
the current package versions.

## Install

Follow [installation and provider setup](react/setup.md#install).

## Start with a balance

The [complete TSX balance example](react/setup.md#start-with-a-balance) uses
[`ColibriQueryProvider`](react/setup.md) and displays a funded account’s
balance.

See [common workflows and convenience APIs](react/convenience.md) for complete
provider, wallet and combined signing setup. Granular APIs remain available.

## Feature imports

Import runtime features from their documented subpaths. The root contains only
configuration, provider, connection hooks and integration errors. Shared type
exports are erased from JavaScript.

| Import after `@colibri/react`    | APIs                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root                             | [`createColibriConfig`](react/setup.md), [`ColibriProvider`](react/setup.md), [`useColibriConfig`](react/hooks/use-colibri-config.md), [`useConnection`](react/hooks/use-connection.md), [`useConnect`](react/hooks/use-connect.md), [`useReconnect`](react/hooks/use-reconnect.md), [`useDisconnect`](react/hooks/use-disconnect.md), [`useNetwork`](react/hooks/use-network.md) |
| `/provider`                      | [`ColibriQueryProvider`](react/setup.md)                                                                                                                                                                                                                                                                                                                                          |
| `/wallet`                        | [`useWallet`](react/hooks/use-wallet.md)                                                                                                                                                                                                                                                                                                                                          |
| `/rpc`                           | [`useRpc`](react/hooks/use-rpc.md), [`useLatestLedger`](react/hooks/use-latest-ledger.md), [`useTransaction`](react/hooks/use-transaction.md), [`useWaitForTransaction`](react/hooks/use-wait-for-transaction.md)                                                                                                                                                                 |
| `/accounts`                      | [`useAccount`](react/hooks/use-account.md), [`useTrustline`](react/hooks/use-trustline.md), [`useLedgerEntries`](react/hooks/use-ledger-entries.md)                                                                                                                                                                                                                               |
| `/assets`                        | [`useBalance`](react/hooks/use-balance.md), [`useTokenMetadata`](react/hooks/use-token-metadata.md)                                                                                                                                                                                                                                                                               |
| `/contracts`                     | [`useContract`](react/hooks/use-contract.md) and its full client type                                                                                                                                                                                                                                                                                                             |
| `/contracts/read`                | [`useContractRead`](react/hooks/use-contract-read.md), [`useContractReadSpec`](react/hooks/use-contract-read-spec.md), [`contractReadQueryOptions`](react/hooks/use-contract-read-spec.md)                                                                                                                                                                                        |
| `/contracts/invoke`              | [`useContractInvoke`](react/hooks/use-contract-invoke.md), [`useWalletContractInvoke`](react/hooks/use-wallet-contract-invoke.md)                                                                                                                                                                                                                                                 |
| `/transactions/classic`          | [`useClassicTransaction`](react/hooks/use-classic-transaction.md)                                                                                                                                                                                                                                                                                                                 |
| `/transactions/soroban`          | [`useSorobanTransaction`](react/hooks/use-soroban-transaction.md)                                                                                                                                                                                                                                                                                                                 |
| `/transactions/simulate`         | [`useSimulateSorobanTransaction`](react/hooks/use-simulate-soroban-transaction.md)                                                                                                                                                                                                                                                                                                |
| `/query`                         | [`colibriQueryKey`](react/queries.md), [`colibriQueryOptions`](react/queries.md), [`queryValue`](react/queries.md), query/mutation controls                                                                                                                                                                                                                                       |
| `/query/mutation`                | [`useColibriMutation`](react/hooks/use-colibri-mutation.md)                                                                                                                                                                                                                                                                                                                       |
| `/events`                        | [`createContractEvents`](react/hooks/use-contract-events.md), [`useContractEvents`](react/hooks/use-contract-events.md)                                                                                                                                                                                                                                                           |
| `/webauth`                       | [`useWebAuthClient`](react/hooks/use-web-auth-client.md), [`useWebAuth`](react/hooks/use-web-auth.md), [`useSession`](react/hooks/use-session.md), session factory                                                                                                                                                                                                                |
| `/session`                       | Framework-independent [`createWebAuthSession`](react/wallets-and-sessions.md#webauth), [`WebAuthSession`](react/wallets-and-sessions.md#webauth)                                                                                                                                                                                                                                  |
| `/sep1`                          | [`useStellarToml`](react/hooks/use-stellar-toml.md)                                                                                                                                                                                                                                                                                                                               |
| `/ecosystem/stellar-wallets-kit` | [`createStellarWalletsKitConnector`](react/wallets-and-sessions.md#stellar-wallets-kit)                                                                                                                                                                                                                                                                                           |
| `/ecosystem/freighter`           | [`createFreighterConnector`](react/wallets-and-sessions.md#direct-freighter)                                                                                                                                                                                                                                                                                                      |
| `/signers`                       | [`useSigners`](react/hooks/use-signers.md), [`useSignMessage`](react/hooks/use-sign-message.md), explicit connection guards                                                                                                                                                                                                                                                       |
| `/wallets`                       | [`createWalletConnector`](react/wallets-and-sessions.md), [`createWalletEnvelopeSigner`](react/wallets-and-sessions.md)                                                                                                                                                                                                                                                           |
| `/wallets/auth-entry`            | [`createWalletAuthEntrySigner`](react/wallets-and-sessions.md#explicit-authorization-entry-signing)                                                                                                                                                                                                                                                                               |
| `/wallets/signer`                | [`createWalletSigner`](react/convenience.md#one-signer-for-both-transaction-stages)                                                                                                                                                                                                                                                                                               |
| `/identicon`                     | [`useIdenticon`](react/hooks/use-identicon.md), unstyled [`AccountIdenticon`](react/hooks/use-identicon.md)                                                                                                                                                                                                                                                                       |

## Contracts and transactions

Keep full clients and their plugins with
[useContract](react/hooks/use-contract.md), read through a generated helper or
an ABI spec, and invoke only from explicit user actions.
[useWalletContractInvoke](react/hooks/use-wallet-contract-invoke.md) fills
missing transaction source and signers from the connected wallet; explicit
overrides remain available.
[Contract and pipeline recipes](react/contracts-and-transactions.md) explain
[transaction configuration](../core/transaction-config.md), simulation and event
subscriptions.

## Stellar identities and SEPs

- XLM: `{ kind: "xlm" }`.
- Classic issued asset: `{ kind: "classic", code, issuer }`.
- [SEP-41](../core/asset/sep-41-token-contract.md) token, including a SAC:
  `{ kind: "sep41", contractId }`.

Classic account/trustline reads use G-addresses.
[SEP-41](../core/asset/sep-41-token-contract.md) balances accept G or C
addresses; muxed attribution belongs to the transaction destination, not a
separate balance. A C-address does not imply an Ed25519 signing capability.

The package composes existing Colibri support: [SEP-1](../core/sep1.md)
discovery, SEP-10/45 WebAuth, [SEP-41](../core/asset/sep-41-token-contract.md)
tokens and event values, [SEP-33](identicon.md) SVG identicons and optional
[SEP-53](../core/signer/message-signing.md) message signing.
[SEP-1](../core/sep1.md) anchor URLs are advertisements; this package does not
implement SEP-6/12/24/31/38 services. Existing Core
[SEP-11](../core/asset/sep-11.md) asset helpers remain available through
`@colibri/core/assets` without a redundant React hook for pure work.

## Lifetimes, errors and server rendering

Use one config per application and separate configs per server request.
[Queries and caching](react/queries.md) explains network scopes, freshness,
mutation retries and serialization.
[Wallets and sessions](react/wallets-and-sessions.md) explains authority
changes, memory-only credentials and cleanup. Event subscriptions have their own
[shared observer lifecycle](react/hooks/use-contract-events.md).

Connection SSR snapshots are disconnected and session SSR snapshots are
anonymous. Render ordinary query/mutation error states and handle connection
Promise rejections at the user-action boundary. React errors have dedicated
subclasses, such as
[`ReactNetworkMismatchError`](react/convenience.md#handle-concrete-failures),
within the [`ColibriReactError`](react/convenience.md#handle-concrete-failures)
family. Use `instanceof` or stable
[React error codes](../reference/errors/react.md) for integration failures;
existing Core and wallet errors retain their identity.

## Guides and API references

- [Setup and providers](react/setup.md)
- [Common workflows](react/convenience.md)
- [Every React hook](react/hooks/README.md)
- [Queries and caching](react/queries.md)
- [Wallets and sessions](react/wallets-and-sessions.md)
- [Contract and pipeline recipes](react/contracts-and-transactions.md)
- [Browser imports and measurements](../getting-started/browser-bundles.md)
- [All React API modules](https://jsr.io/@colibri/react/doc)
