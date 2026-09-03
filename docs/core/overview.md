# Core

`@colibri/core` is Colibri's foundation: transaction orchestration, account and
contract clients, signing, current ledger reads, historical parsing, and events.

```sh
deno add jsr:@colibri/core
```

For a first working integration, use the
[Testnet payment tutorial](../getting-started/quick-start.md) or
[contract tutorial](../getting-started/contract-call.md). They include setup and
explain what runs locally and what reaches the network.

## Choose a layer

| Layer    | Use it when                                                                     | Guide                                                                            |
| -------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Client   | You want contract methods or asset operations with the pipeline managed for you | [Contract](contract.md), [StellarAssetContract](asset/stellar-asset-contract.md) |
| Pipeline | You want a complete transaction flow and plugin attachment points               | [Pipelines](pipelines/README.md)                                                 |
| Step     | You are composing a workflow and need stable IDs and Conv context               | [Steps](steps.md)                                                                |
| Process  | You need one operation such as building, simulating, or signing                 | [Processes](processes/README.md)                                                 |
| Helpers  | You need values, conversions, keys, or local validation                         | [Shared helpers](helpers.md)                                                     |

Clients build on pipelines; pipelines compose steps; steps wrap processes.
Plugins target explicit pipeline/step IDs. Using a low-level process does not
automatically execute the surrounding validation, signing, or submission flow.

## Values and configuration

- [Network](network.md) — network identity, endpoints, and explicit providers.
- [Accounts](account.md), [addresses](address.md), and [StrKeys](strkeys.md) —
  distinguish account identity, muxed addresses, and signer capabilities.
- [Signers](signer/README.md) and [authorization](authorization.md) — envelope
  signing versus Soroban authorization entries, including delegation.
- [Transaction config](transaction-config.md) — sources, fee modes, signers,
  timebounds, and simulation-related parameters.
- [Assets](asset/README.md) — canonical asset strings and SAC clients.
- [SEP-1 discovery](sep1.md) — TOML parsing and service discovery.

## Read data without constructing a write transaction

[Ledger Entries](ledger-entries.md) reads current typed state through RPC.
[Ledger Parser](ledger-parser.md) interprets historical ledger/transaction XDR.
[Contract.read](contract/invocation.md) simulates a contract method without
submitting a transaction. These are different operations with different
freshness and authorization implications.

[Events](../events/overview.md) normalizes emitted data; filters and templates
help select and decode it. Use [RPC Streamer](../packages/rpc-streamer.md) for
continued ingestion and [TOIDs](toid.md) for historical operation locations.

## Errors and API reference

See [handling errors](error.md) before adding retries. A local build, a
simulation, and confirmed submission are different stages; a generic retry after
a submission timeout can create a second operation.

The [module map](../reference/README.md#core-module-map) covers the public
families, and the [JSR API](https://jsr.io/@colibri/core/doc) provides exact
types, overloads, and symbols. Core's `xdr` export is a helper namespace; use
the underlying Stellar SDK's `xdr` for XDR classes.
