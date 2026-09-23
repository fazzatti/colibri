# Introduction

{% hint style="info" %} Colibri packages have independent versions. See
[compatibility and releases](getting-started/compatibility.md) for the stability
and versioning policy. {% endhint %}

<figure><picture><source srcset=".gitbook/assets/colibri-logo-dark (1).png" media="(prefers-color-scheme: dark)"><img src=".gitbook/assets/colibri-logo.png" alt="Colibri"></picture><figcaption></figcaption></figure>

Colibri is a TypeScript toolkit for Stellar applications. Use a
[focused client](core/overview.md#choose-a-layer) for a common workflow, a
[transaction pipeline](core/pipelines/README.md) when you need to attach
[plugins](packages/plugins/README.md), or an individual
[process](core/processes/README.md) when you need to control orchestration.

These guides explain **how and why** to use the APIs. The
[API and error reference](reference/README.md) links every package's generated
symbol documentation and lists every declared error code by context.

## Choose your task

| I want to…                                | Start here                                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Install a package and submit a payment    | [Installation](getting-started/installation.md), [first transaction](getting-started/quick-start.md) |
| Read or invoke a Soroban contract         | [Contract tutorial](getting-started/contract-call.md), [Contract client](core/contract.md)           |
| Generate a typed contract client          | [Contract Bindings](packages/contract-bindings.md)                                                   |
| Build a React application                 | [React setup](packages/react/setup.md), [common workflows](packages/react/convenience.md)            |
| Choose fees, signers, and authorization   | [Transaction config](core/transaction-config.md), [authorization](core/authorization.md)             |
| Adjust Soroban budgets and resource fees  | [Resource overrides, padding and calculation](core/resources.md)                                     |
| Read current ledger state                 | [Ledger Entries](core/ledger-entries.md)                                                             |
| Follow events or historical ledgers       | [RPC Streamer](packages/rpc-streamer.md)                                                             |
| Authenticate a wallet or contract account | [WebAuth](packages/webauth.md)                                                                       |
| Rebuild and compare a contract's Wasm     | [Build Verification](packages/build-verification.md)                                                 |
| Render an account or contract identicon   | [Identicons](packages/identicon.md)                                                                  |
| Run a disposable local ledger             | [Test Tooling](packages/test-tooling.md)                                                             |

## Packages

Install only the packages your application needs. Events, account/address
helpers, ledger readers, and transaction orchestration belong to Core; the other
packages provide focused capabilities.

| Package                                                                    | Scope                                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`@colibri/core`](core/overview.md)                                        | Accounts, assets, contracts, signing, processes, pipelines, ledger data, and events               |
| [`@colibri/contract-bindings`](packages/contract-bindings.md)              | Typed clients, validated values and event definitions from a contract ABI                         |
| [`@colibri/react`](packages/react.md)                                      | Providers, wallet connections, queries and explicit transaction hooks                             |
| [`@colibri/rpc-streamer`](packages/rpc-streamer.md)                        | Live/archive ingestion with callbacks and checkpoints                                             |
| [`@colibri/webauth`](packages/webauth.md)                                  | [SEP-10](packages/webauth/sep10.md) and [SEP-45](packages/webauth/sep45.md) client authentication |
| [`@colibri/build-verification`](packages/build-verification.md)            | SEP-58 and caller-supplied reproducible build verification, API and CLI                           |
| [`@colibri/identicon`](packages/identicon.md)                              | [SEP-33](packages/identicon.md) SVG, PNG and image data, with extended C-address support          |
| [`@colibri/plugin-fee-bump`](packages/plugins/fee-bump.md)                 | Fee sponsorship for transaction pipelines                                                         |
| [`@colibri/plugin-channel-accounts`](packages/plugins/channel-accounts.md) | Reusable sponsored transaction-source accounts                                                    |
| [`@colibri/plugin-sep29`](packages/plugins/sep29.md)                       | Opt-in receiving-account memo checks                                                              |
| [`@colibri/test-tooling`](packages/test-tooling.md)                        | Docker-backed Stellar Quickstart lifecycle                                                        |

## How to read the guides

Start with a complete tutorial, then follow the scoped guides for configuration,
failure handling, or customization. Short fragments illustrate one step; they
are not independent scripts unless explicitly labeled. Placeholder secrets,
contract IDs, and example domains must be supplied by your application.

The [architecture guide](getting-started/architecture.md) explains the shared
process → step → pipeline → client layering. The
[error-handling guide](core/error.md) explains stable codes and safe
diagnostics.

## Resources

- [Colibri source](https://github.com/fazzatti/colibri)
- [Runnable examples repository](https://github.com/fazzatti/colibri-examples)
- [Stellar developer documentation](https://developers.stellar.org/)
