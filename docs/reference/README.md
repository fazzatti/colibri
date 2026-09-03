# API and error reference

GitBook explains workflows, tradeoffs, and integration boundaries. JSR generates
the full symbol/type reference from each package's actual public entrypoints.
Use both: a guide teaches how to compose APIs; the API reference defines their
exact current signatures.

## Packages and entrypoints

| Package                            | Developer guide                                     | Full API                                                       |
| ---------------------------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| `@colibri/core`                    | [Core](../core/overview.md)                         | [Symbols](https://jsr.io/@colibri/core/doc)                    |
| `@colibri/rpc-streamer`            | [Streaming](../packages/rpc-streamer.md)            | [Symbols](https://jsr.io/@colibri/rpc-streamer/doc)            |
| `@colibri/webauth`                 | [WebAuth](../packages/webauth.md)                   | [Symbols](https://jsr.io/@colibri/webauth/doc)                 |
| `@colibri/build-verification`      | [Verification](../packages/build-verification.md)   | [Symbols](https://jsr.io/@colibri/build-verification/doc)      |
| `@colibri/identicon`               | [Identicons](../packages/identicon.md)              | [Symbols](https://jsr.io/@colibri/identicon/doc)               |
| `@colibri/plugin-fee-bump`         | [Fee sponsorship](../packages/plugins/fee-bump.md)  | [Symbols](https://jsr.io/@colibri/plugin-fee-bump/doc)         |
| `@colibri/plugin-channel-accounts` | [Channels](../packages/plugins/channel-accounts.md) | [Symbols](https://jsr.io/@colibri/plugin-channel-accounts/doc) |
| `@colibri/test-tooling`            | [Quickstart](../packages/test-tooling.md)           | [Symbols](https://jsr.io/@colibri/test-tooling/doc)            |

Build Verification also exports `/core`, `/docker`, and `/cli`. All other listed
packages expose their supported surface at the package root. Internal file
paths, `@/`, `colibri-internal/`, and `_tools/` are repository conventions, not
public consumer imports.

## Core module map

| Surface                                                 | Guide                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts, address normalization, branded StrKeys        | [Account](../core/account.md), [Addresses](../core/address.md), [StrKeys](../core/strkeys.md)                                                           |
| Assets, SEP-11, SAC client                              | [Assets](../core/asset/README.md)                                                                                                                       |
| Contract client, spec loading, deployment               | [Contract](../core/contract.md)                                                                                                                         |
| Network presets, providers, TOML discovery              | [Network](../core/network.md), [SEP-1](../core/sep1.md)                                                                                                 |
| Signer capabilities and classic/auth-entry requirements | [Signers](../core/signer/README.md), [Authorization](../core/authorization.md)                                                                          |
| Transaction config, fee strategies, validity            | [Configuration](../core/transaction-config.md)                                                                                                          |
| Processes, wrappers, built-in pipelines, plugins        | [Processes](../core/processes/README.md), [Steps](../core/steps.md), [Pipelines](../core/pipelines/README.md), [Plugins](../packages/plugins/README.md) |
| Ledger keys/current state and lazy ledger parsing       | [Entries](../core/ledger-entries.md), [Parser](../core/ledger-parser.md)                                                                                |
| Events, filters, templates, event IDs                   | [Events](../events/overview.md), [TOID](../core/toid.md)                                                                                                |
| Binary/XDR, decimal, assertion, type guard helpers      | [Shared helpers](../core/helpers.md)                                                                                                                    |
| Friendbot tools                                         | [Friendbot](../core/tools/friendbot.md)                                                                                                                 |
| Error classes, registries, diagnostics                  | [Handling errors](../core/error.md), [Every error context](errors/README.md)                                                                            |

## Version and example scope

The documentation describes the repository's current released API. Use JSR's
version selector when reading an older installed release. Low-level SDK objects
in the guides use Stellar SDK 17 and `Uint8Array`, not the pre-17 Buffer/XDR
API.

Examples labeled as complete scripts include installation, prerequisites, and
run instructions. Fragments demonstrate one step and name the values supplied by
your application. Example addresses, endpoints under `example.com`, recipe
digests, and secrets marked with ellipses are placeholders, not working services
or credentials. Never paste production secrets into a tutorial or terminal log.
