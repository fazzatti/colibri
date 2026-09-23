# Hooks

Each public React hook has its own reference below: purpose, parameters, result,
short TSX example and important lifecycle behavior. Start with
[setup and providers](../setup.md) if this is your first Colibri component.

[`ColibriQueryProvider`](../setup.md) supplies both providers required by query
and mutation hooks. See [common workflows](../convenience.md) for one complete
provider and wallet setup.

Examples are complete components with application inputs supplied as props. They
assume the providers stated on each page are mounted above the component. Keep
hooks unconditional; disable a query with its supported missing input or
`enabled: false` instead of conditionally calling a hook. A disabled query may
still report `isPending` before it has data; check the missing input or fetching
state before rendering an indefinite loading indicator.

Queries and mutations return TanStack Query results. Connection actions instead
return Promise-producing functions. See [queries and caching](../queries.md) for
shared controls, invalidation and server rendering.

## Configuration and connection

- [useWallet](use-wallet.md): Observe wallet state, guarded signers and explicit
  connection actions together.

- [useColibriConfig](use-colibri-config.md): Read the application configuration
  supplied by the nearest provider.
- [useConnection](use-connection.md): Observe the current wallet connection and
  connection lifecycle.
- [useConnect](use-connect.md): Connect an explicitly selected wallet connector.
- [useReconnect](use-reconnect.md): Restore a previously authorized wallet
  connection without prompting.
- [useDisconnect](use-disconnect.md): Clear the active connection and request
  wallet-side disconnection when supported.
- [useNetwork](use-network.md): Read the provider’s configured Stellar network.

## RPC

- [useRpc](use-rpc.md): Access a memoized Stellar RPC client for advanced calls.
- [useLatestLedger](use-latest-ledger.md): Query the latest ledger observed by
  the configured RPC server.
- [useTransaction](use-transaction.md): Look up a transaction hash through
  Stellar RPC.
- [useWaitForTransaction](use-wait-for-transaction.md): Poll a transaction hash
  until RPC reports a terminal status.

## Accounts

- [useLedgerEntries](use-ledger-entries.md): Access a stable Core ledger reader
  for direct, known-key reads.
- [useAccount](use-account.md): Read a Classic account’s ledger entry, including
  balance, thresholds and signers.
- [useTrustline](use-trustline.md): Read a Classic trustline’s balance and
  ledger metadata.

## Assets

- [useBalance](use-balance.md): Read an exact XLM, Classic issued-asset or
  [SEP-41](../../../core/asset/sep-41-token-contract.md) token balance.
- [useTokenMetadata](use-token-metadata.md): Read a deployed
  [SEP-41](../../../core/asset/sep-41-token-contract.md) contract’s name, symbol
  and decimal precision.

## Contract instances

- [useContract](use-contract.md): Retain a full Core Contract or generated
  subclass across ordinary rerenders.

## Contract reads

- [useContractRead](use-contract-read.md): Query a generated client’s typed
  method helper through its existing
  [read pipeline](../../../core/pipelines/read-from-contract.md).
- [useContractReadSpec](use-contract-read-spec.md): Simulate a spec-described
  method without constructing a full Contract client.

## Contract invocations

- [useWalletContractInvoke](use-wallet-contract-invoke.md): Invoke a generated
  method with wallet-derived source and signers, preserving explicit overrides.

- [useContractInvoke](use-contract-invoke.md): Invoke a generated method using
  the client’s existing invocation pipeline.

## Application mutations

- [useColibriMutation](use-colibri-mutation.md): Run an application-owned SDK
  action with Colibri’s serialization and no automatic retries.

## Classic transactions

- [useClassicTransaction](use-classic-transaction.md): Submit Classic operations
  through Colibri’s existing Classic pipeline.

## Soroban transactions

- [useSorobanTransaction](use-soroban-transaction.md): Run the existing Soroban
  invocation pipeline from a component action.

## Simulation

- [useSimulateSorobanTransaction](use-simulate-soroban-transaction.md): Simulate
  a prepared native Soroban transaction without signing or submitting it.

## Events

- [useContractEvents](use-contract-events.md): Observe an application-owned,
  shared contract-event stream.

## Signers

- [useSigners](use-signers.md): Read the connected wallet’s explicit, guarded
  signing capabilities.
- [useSignMessage](use-sign-message.md): Request a
  [SEP-53](../../../core/signer/message-signing.md) signature from the
  connection’s optional message signer.

## WebAuth and sessions

- [useWebAuthClient](use-web-auth-client.md): Discover a unified SEP-10/SEP-45
  WebAuth client for a service domain.
- [useSession](use-session.md): Observe a shared, memory-only WebAuth session.
- [useWebAuth](use-web-auth.md): Authenticate on demand through a shared WebAuth
  session.

## SEP-1 discovery

- [useStellarToml](use-stellar-toml.md): Fetch and validate a domain’s
  [SEP-1](../../../core/sep1.md) stellar.toml discovery document.

## Identicons

- [useIdenticon](use-identicon.md): Generate a deterministic SVG data URL for a
  Stellar address locally.
