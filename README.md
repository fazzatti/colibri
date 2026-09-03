<div align="center">
  <a href="https://jsr.io/@colibri/core" title="@Colibri/core">
    <img alt="@Colibri" src="./_internal/img/colibri-logo-light.png" alt="Colibri Logo" width="300" />
  </a>
  <br />
  <h1>@colibri</h1>
</div>

<p align="center">
A TypeScript-first toolkit for building, authenticating, testing, operating, and verifying Stellar applications.
</p>

<p align="center">
  <a href="https://fifo-docs.gitbook.io/colibri">📚 Documentation</a> | <a href="https://github.com/fazzatti/colibri-examples">💡 Examples</a>
</p>

<div align="center">

<a href="https://jsr.io/@colibri">
    <img src="https://jsr.io/badges/@colibri/" alt="JSR @colibri" />
  </a>
<a href="https://github.com/fazzatti/colibri/actions/workflows/deno.yml">
    <img src="https://github.com/fazzatti/colibri/actions/workflows/deno.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://codecov.io/gh/fazzatti/colibri" >
    <img src="https://codecov.io/gh/fazzatti/colibri/branch/main/graph/badge.svg?token=QMVWNRZNWC"/>
 </a>
  <a href="https://opensource.org/licenses/mit-license.php">
    <img alt="MIT Licence" src="https://badges.frapsoft.com/os/mit/mit.svg?v=103" />
  </a>
  <a href="https://github.com/ellerbrock/open-source-badge/">
    <img alt="Open Source Love" src="https://badges.frapsoft.com/os/v1/open-source.svg?v=103" />
  </a>

</div>

<br />

## What is Colibri?

Colibri is a family of focused packages built on the Stellar JavaScript SDK. It
adds higher-level workflows where applications repeatedly need to coordinate
network configuration, account sequence numbers, Soroban simulation,
authorization entries, envelope signatures, submission, and typed failures.

Use only the packages needed at each stage of a project:

| When you are...            | Colibri helps you...                                                                                      | Start with                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Prototyping transactions   | Send classic operations, read or invoke contracts, manage assets, and inspect ledger state                | [`@colibri/core`](./core/README.md)                                                                                                    |
| Integrating a Stellar site | Discover `stellar.toml` services and authenticate classic, muxed, or contract accounts                    | [`@colibri/core`](./core/README.md), [`@colibri/webauth`](./webauth/README.md)                                                         |
| Building account UI        | Render deterministic local identicons without treating them as proof of ownership                         | [`@colibri/identicon`](./identicon/README.md)                                                                                          |
| Testing locally            | Start, inspect, reuse, and clean up a Docker-backed Stellar Quickstart ledger                             | [`@colibri/test-tooling`](./test-tooling/README.md)                                                                                    |
| Preparing for production   | Add fee sponsorship or reuse sponsored channel accounts without replacing the transaction pipeline        | [`@colibri/plugin-fee-bump`](./plugins/fee-bump/README.md), [`@colibri/plugin-channel-accounts`](./plugins/channel-accounts/README.md) |
| Operating an integration   | Ingest live events or ledgers, recover older ranges from archive RPC, and checkpoint application progress | [`@colibri/rpc-streamer`](./rpc-streamer/README.md)                                                                                    |
| Shipping contract releases | Rebuild a contract from committed metadata or an explicit recipe and compare the exact resulting Wasm     | [`@colibri/build-verification`](./build-verification/README.md)                                                                        |

The packages compose through shared Core types, but they are published
separately. A UI that only needs identicons does not need the transaction
pipeline; a CI job that only verifies Wasm can use Build Verification without
adopting every runtime package.

## A development journey

Colibri can follow an application from its first local transaction to an
operated production service:

1. **Model the network and identities.** Use Core network profiles, checked
   StrKeys, account wrappers, SEP-11 asset strings, and SEP-1 `stellar.toml`
   discovery rather than copying endpoint and address logic across the app.
2. **Read and write Stellar state.** Start with high-level contract clients and
   classic or Soroban pipelines. Drop down to reusable processes, stable steps,
   raw XDR helpers, or ledger-entry readers when the application needs control.
3. **Integrate users and services.** Use WebAuth for explicit SEP-10 and SEP-45
   challenge flows and Identicon for a familiar visual representation of a
   complete account address. Authentication and visual identity remain separate
   security boundaries.
4. **Test the real workflow.** Run the same Core code against a disposable
   Quickstart network through Test Tooling. Keep unit tests fast and reserve the
   local ledger for transaction, contract, event, and authorization boundaries.
5. **Add operational concerns.** Compose fee-bump or channel-account plugins at
   their intended pipeline boundaries, then consume live and archived data with
   RPC Streamer.
6. **Verify what you deploy.** Use Build Verification to reproduce contract Wasm
   in an isolated build environment and retain structured evidence of the exact
   comparison.

Colibri implements Stellar-specific standards and protocol capabilities; it is
not a general identity-provider framework. Current standard-oriented surfaces
include SEP-1 discovery, SEP-10 and draft SEP-45 Web Authentication, SEP-11
asset strings, SEP-23 StrKeys, SEP-33 identicons, SEP-35 operation IDs, SEP-41
token events, and SEP-58 contract build verification. Follow each package's
documentation for its exact support boundary.

## Packages

### [@colibri/core](./core) <a href="https://jsr.io/@colibri/core"><img src="https://jsr.io/badges/@colibri/core" alt="JSR @colibri/core" /></a>

The foundation of the Colibri ecosystem. Provides pipelines, processes, and
utilities for Stellar and Soroban workflows.

```sh
deno add jsr:@colibri/core
# or
npx jsr add @colibri/core
```

[View Documentation →](./core/README.md)

---

### [@colibri/webauth](./webauth) <a href="https://jsr.io/@colibri/webauth"><img src="https://jsr.io/badges/@colibri/webauth" alt="JSR @colibri/webauth" /></a>

Unified SEP-10 and SEP-45 Web Authentication with deterministic account routing,
strict challenge verification, custom contract authorization, and enforcing
Soroban simulation.

```sh
deno add jsr:@colibri/webauth
# or
npx jsr add @colibri/webauth
```

[View Documentation →](./webauth/README.md)

---

### [@colibri/build-verification](./build-verification) <a href="https://jsr.io/@colibri/build-verification"><img src="https://jsr.io/badges/@colibri/build-verification" alt="JSR @colibri/build-verification" /></a>

Reproducible SEP-58 and out-of-band Stellar contract build verification with
digest-pinned images, exact source hashing, isolated Docker builds, typed
errors, and exportable evidence.

```sh
deno add jsr:@colibri/build-verification
# or
npx jsr add @colibri/build-verification
```

[View Documentation →](./build-verification/README.md)

---

### [@colibri/identicon](./identicon) <a href="https://jsr.io/@colibri/identicon"><img src="https://jsr.io/badges/@colibri/identicon" alt="JSR @colibri/identicon" /></a>

Local, reference-compatible SEP-33 Stellar identicons with immutable pattern
data, SVG and PNG output, data URLs, and explicit presentation options.

```sh
deno add jsr:@colibri/identicon
# or
npx jsr add @colibri/identicon
```

[View Documentation →](./identicon/README.md)

---

### [@colibri/plugin-fee-bump](./plugins/fee-bump) <a href="https://jsr.io/@colibri/plugin-fee-bump"><img src="https://jsr.io/badges/@colibri/plugin-fee-bump" alt="JSR @colibri/plugin-fee-bump" /></a>

A plugin that enables fee sponsorship by wrapping transactions in Fee Bump
Transactions.

```sh
deno add jsr:@colibri/plugin-fee-bump
# or
npx jsr add @colibri/plugin-fee-bump
```

[View Documentation →](./plugins/fee-bump/README.md)

---

### [@colibri/plugin-channel-accounts](./plugins/channel-accounts) <a href="https://jsr.io/@colibri/plugin-channel-accounts"><img src="https://jsr.io/badges/@colibri/plugin-channel-accounts" alt="JSR @colibri/plugin-channel-accounts" /></a>

A plugin and channel management helper for reusing sponsored Stellar channel
accounts across classic and Soroban transaction pipelines.

```sh
deno add jsr:@colibri/plugin-channel-accounts
# or
npx jsr add @colibri/plugin-channel-accounts
```

[View Documentation →](./plugins/channel-accounts/README.md)

---

### [@colibri/rpc-streamer](./rpc-streamer) <a href="https://jsr.io/@colibri/rpc-streamer"><img src="https://jsr.io/badges/@colibri/rpc-streamer" alt="JSR @colibri/rpc-streamer" /></a>

A real-time event streaming client for Stellar/Soroban that supports live
streaming, historical ingestion, and automatic mode switching.

```sh
deno add jsr:@colibri/rpc-streamer
# or
npx jsr add @colibri/rpc-streamer
```

[View Documentation →](./rpc-streamer/README.md)

---

### [@colibri/test-tooling](./test-tooling) <a href="https://jsr.io/@colibri/test-tooling"><img src="https://jsr.io/badges/@colibri/test-tooling" alt="JSR @colibri/test-tooling" /></a>

Docker-backed test infrastructure helpers for Colibri packages, centered on
`StellarTestLedger` for local Quickstart-based integration tests.

```sh
deno add jsr:@colibri/test-tooling
# or
npx jsr add @colibri/test-tooling
```

[View Documentation →](./test-tooling/README.md)

---

## Design principles

### Start high-level, keep the lower layers available

Core clients and pipelines handle complete workflows. The same implementation is
exposed as plain **processes** for direct reuse, thin `convee` **steps** with
stable identifiers, and **connectors** that carry typed state between them. An
application can begin with a standard pipeline and replace or extend only the
boundary it owns.

### Keep authorization mechanisms explicit

Classic envelope signatures and Soroban authorization entries are different
layers. Core models signer capabilities independently and selects only the
capability required by the current step. WebAuth then adds protocol-specific
challenge validation without pretending that every contract authenticates the
same way.

### Fail with structured context

Core and most dependent packages expose named errors with stable codes and
structured metadata rather than requiring callers to parse messages. Packages
with different runtime boundaries retain their own typed families—for example,
Test Tooling uses `QuickstartError` and RPC Streamer uses `RPCStreamerError`.

### Treat plugins as intentional seams

Plugins target stable pipeline or step identifiers. For example, Fee Bump wraps
the outgoing envelope at `send-transaction`, while Channel Accounts manages a
temporary transaction source around supported pipelines. This keeps operational
policy out of the reusable transaction processes.

---

## Architecture

The system is built in layers, aiming to provide both high-level tools for
specific use cases and highly specialized, bullet-proof building blocks.

- **Layer 4: Packages and integrations**
  - WebAuth, Build Verification, Identicon, Test Tooling, RPC Streamer, and
    transaction plugins compose around the Core boundaries.
- **Layer 3: Pipelines**
  - High-level classic transaction, contract read, and contract invocation
    workflows.
- **Layer 2: Steps, connectors, and processes**
  - Plain execution functions plus `convee` orchestration boundaries.
- **Layer 1: Shared primitives**
  - Networks, accounts, signers, errors, ledger views, events, addresses,
    assets, authorization, and XDR helpers.

---

## Development

This workspace is a Deno monorepo. We use specific tasks defined in
[`deno.json`](deno.json) to maintain quality.

### Testing

Run the test suite. You can run all tests or target specific types.

```sh
# Run all tests (Unit + Integration)
deno task test

# Run only unit tests
deno task test:unit

# Run only integration tests (requires network connection)
deno task test:integration
```

### Linting

Ensure code style consistency.

```sh
deno lint
```

### Documentation

GitBook guides live under [`docs/`](docs/README.md), with scoped navigation in
[`docs/SUMMARY.md`](docs/SUMMARY.md). Update the affected guides, examples,
README/JSDoc and error references alongside every public change.

```sh
# Regenerate the complete error catalog after changing declared error codes
deno task docs:errors

# Exercise the documentation guard, then validate the actual guides/examples
deno task test:docs
deno task check:docs
```

Complete TypeScript examples use a `<!-- deno-check -->` marker immediately
before the code fence. CI checks their types without executing transactions,
Docker builds or other external effects. Shorter fragments are syntax-checked.
The same check verifies links/headings, navigation, reference freshness and
installation versions. Keep internal fixture instructions out of published
package READMEs.

## License

MIT License - see [LICENSE](./LICENSE) for details.

**Status:** Beta (🪶)
