<div align="center">
  <a href="https://jsr.io/@colibri/core" title="@colibri/core">
    <img src="./_internal/img/colibri-logo-light.png" alt="Colibri logo" width="300" />
  </a>
  <br />
  <h1>@colibri</h1>
</div>

<p align="center">
  <strong><a href="https://fifo-docs.gitbook.io/colibri">Documentation</a></strong> |
  <a href="https://github.com/fazzatti/colibri-examples">Runnable examples</a> |
  <a href="https://jsr.io/@colibri">JSR packages</a>
</p>

<p align="center">
  TypeScript packages for Stellar transactions, Soroban contracts,
  authorization, testing, data ingestion, and contract build verification.
</p>

<div align="center">
  <a href="https://jsr.io/@colibri">
    <img src="https://jsr.io/badges/@colibri/" alt="JSR @colibri" />
  </a>
  <a href="https://github.com/fazzatti/colibri/actions/workflows/deno.yml">
    <img src="https://github.com/fazzatti/colibri/actions/workflows/deno.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://codecov.io/gh/fazzatti/colibri">
    <img src="https://codecov.io/gh/fazzatti/colibri/branch/main/graph/badge.svg?token=QMVWNRZNWC" alt="Codecov" />
  </a>
  <a href="https://opensource.org/licenses/mit-license.php">
    <img src="https://badges.frapsoft.com/os/mit/mit.svg?v=103" alt="MIT license" />
  </a>
</div>

<br />

## Overview

Colibri is a Deno workspace of independently published packages built on the
Stellar JavaScript SDK. It keeps Stellar SDK operations, transactions, XDR
values, and RPC clients as the protocol boundary, and adds reusable structure
for the application workflows around them.

The central package, `@colibri/core`, separates transaction work into plain
processes, stable pipeline steps, typed connectors, and complete callable
pipelines. The other packages cover testing, authentication standards,
continuous RPC ingestion, contract build verification, transaction plugins, and
address identicons.

## Packages

| Package                                                                    | Primary responsibility                                                   | Main surfaces                                                                                                                    |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| [`@colibri/core`](./core/README.md)                                        | Stellar and Soroban application primitives and transaction orchestration | Network configuration, accounts, signers, classic and Soroban pipelines, contracts, assets, ledger entries, events, typed errors |
| [`@colibri/test-tooling`](./test-tooling/README.md)                        | Integration testing against a real local Stellar network                 | `StellarTestLedger`, named Quickstart containers, service configuration, readiness, logs, reuse, and cleanup                     |
| [`@colibri/webauth`](./webauth/README.md)                                  | SEP-10 and SEP-45 Web Authentication                                     | `stellar.toml` discovery, explicit or account-based protocol routing, challenge validation, signing, and JWT retrieval           |
| [`@colibri/rpc-streamer`](./rpc-streamer/README.md)                        | Checkpointed ledger and contract-event ingestion                         | Live RPC polling, archive RPC backfill, pagination, recovery, checkpoints, and custom ingestors                                  |
| [`@colibri/build-verification`](./build-verification/README.md)            | Reproducible Stellar contract build verification                         | SEP-58 and out-of-band targets, source and image resolution, bounded Docker builds, Wasm comparison, evidence, and CLI output    |
| [`@colibri/plugin-fee-bump`](./plugins/fee-bump/README.md)                 | Fee sponsorship for transaction pipelines                                | Fee-bump envelope construction and fee-source authorization at the `send-transaction` step                                       |
| [`@colibri/plugin-channel-accounts`](./plugins/channel-accounts/README.md) | Reusable transaction source accounts for concurrent workloads            | Sponsored channel-account lifecycle, allocation, signer injection, and release around supported pipelines                        |
| [`@colibri/identicon`](./identicon/README.md)                              | Deterministic SEP-33-compatible account visuals                          | Local pattern generation and SVG, PNG, or data-URL rendering                                                                     |

Packages are versioned and published separately. Applications only need to
install the packages used by their runtime or development workflow.

## Installation

Install Core with Deno:

```sh
deno add jsr:@colibri/core
```

Or add it to a Node.js project through JSR:

```sh
npx jsr add @colibri/core
```

Replace `@colibri/core` with another package name from the table above when only
that package is required.

## Core architecture

Colibri's transaction architecture is layered by responsibility. Each layer is
publicly reusable; higher-level APIs compose the same lower-level functions
rather than maintaining separate implementations.

| Layer          | Responsibility                                                                                 | Typical use                                                        |
| -------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Primitives     | Networks, accounts, signers, assets, identifiers, XDR helpers, ledger keys, events, and errors | Direct protocol and data handling                                  |
| Processes      | One plain TypeScript execution unit with typed input, output, and failures                     | Reuse one operation in application-owned orchestration             |
| Steps          | A process wrapped with a stable `convee` identifier                                            | Observation, plugins, and pipeline composition                     |
| Connectors     | Typed conversion from one step's output to the next step's input                               | Preserve explicit state transitions and access earlier run context |
| Pipelines      | Ordered end-to-end transaction workflows                                                       | Execute a standard classic or Soroban lifecycle                    |
| Domain clients | APIs that configure and invoke one or more pipelines                                           | Work with a contract, asset, or ledger domain object               |

Processes, steps, and pipelines are callable values. Their composition APIs
remain available on the same values, so an application can attach a plugin or
replace a lifecycle boundary without changing how the workflow is invoked.

### Built-in transaction pipelines

| Pipeline            | Execution path                                                                                                                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classic transaction | Load a G-address or M-address source and sequence → build from Stellar SDK operations → resolve account and operation thresholds → apply matching envelope signers → submit, confirm, and expose typed runtime outcomes |
| Contract read       | Build an ephemeral transaction → simulate → decode and return the contract result; no envelope is signed or submitted                                                                                                   |
| Contract invocation | Build → recording simulation → authorize Soroban entries → assemble and enforce delegated credentials when present → assemble resources and fees → resolve envelope requirements → sign → submit and confirm            |

The simulation response remains the source of Soroban resource data and
authorization entries. Assembly carries that response into the transaction;
applications do not need to reconstruct the footprint or resource fee.

### Minimal classic transaction

The following Testnet example uses a callable pipeline directly. See the
[complete quick start](./docs/getting-started/quick-start.md) for setup notes
and the [examples repository](https://github.com/fazzatti/colibri-examples) for
standalone projects.

<!-- deno-check -->

```ts
import {
  createClassicTransactionPipeline,
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { Asset, Operation } from "stellar-sdk";

const network = NetworkConfig.TestNet();
const sender = LocalSigner.generateRandom();
const recipient = LocalSigner.generateRandom();

for (const signer of [sender, recipient]) {
  await initializeWithFriendbot(network.friendbotUrl, signer.publicKey(), {
    rpcUrl: network.rpcUrl,
    allowHttp: network.allowHttp,
  });
}

const sendPayment = createClassicTransactionPipeline({
  networkConfig: network,
});

const result = await sendPayment({
  operations: [Operation.payment({
    destination: recipient.publicKey(),
    asset: Asset.native(),
    amount: "1",
  })],
  config: {
    source: sender.publicKey(),
    signers: [sender],
    fee: "100",
    timeout: 30,
  },
});

console.log(result.hash);
console.log(result.feeCharged);

const payment = result.operations[0];
if (payment.type === "payment") {
  console.log(payment.result.type); // paymentSuccess
}
```

## Signers and authorization

Transaction-envelope authorization and Soroban authorization entries are
separate capabilities. A signer may implement either capability or both, and the
relevant process narrows the signer before invoking it.

Core includes implementations for:

| Signer                           | Capability                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `LocalSigner`                    | Ed25519 envelope signatures and Soroban authorization entries                               |
| `HashXSigner`                    | Hash-X envelope authorization using a preimage                                              |
| `Ed25519SignedPayloadSigner`     | Ed25519 signed-payload envelope authorization                                               |
| `PreAuthorizedTransactionSigner` | Validation of an exact pre-authorized transaction hash without adding a decorated signature |
| `DelegatedSigner`                | Recursive delegated Soroban authorization entries                                           |

Applications can implement the same interfaces for wallets, remote signing
services, hardware devices, or contract-specific authorization. The pipeline
matches signers to requirements through `signsFor(...)`; it does not assume that
every signer owns an accessible secret key.

## Contracts, assets, and ledger data

Core exposes several levels of contract access:

- `Contract` loads contract specifications, binds deployed contracts, deploys
  Wasm or external executable references, and routes reads and invocations
  through the standard pipelines.
- `SEP41TokenContract` provides the exact portable SEP-41 interface for custom
  token contracts, including muxed transfer destinations, while retaining its
  underlying `Contract` for implementation-specific methods.
- `StellarAssetContract` provides typed operations for Stellar Asset Contract
  administration, balances, allowances, authorization, minting, burning, and
  transfers.
- `LedgerEntries` reads typed current-state entries, including accounts,
  contract instances, contract code, data, and configuration.
- ledger parsing and event schemas turn closed-ledger XDR and contract events
  into typed application data.

Use `RPC Streamer` when ledger or event processing must continue over time. It
owns pagination, checkpoints, archive backfill, the transition to live RPC, and
waiting at the network head. It does not replace Core's typed parsing or
current-state readers.

## Testing with Quickstart

`@colibri/test-tooling` manages Docker-backed Stellar Quickstart instances for
tests that require ledger behavior. `StellarTestLedger` controls the container
name, image, network, enabled services, ports, readiness, logs, reuse policy,
and cleanup, then exposes network values that can be used by Core.

Use a local ledger for behavior that a mock cannot establish, including:

- account sequences and transaction submission;
- contract deployment, simulation, and authorization;
- Soroban resource assembly and fee handling;
- emitted events and persisted ledger state;
- fee-bump and channel-account lifecycle behavior.

Pure conversion, validation, and requirement logic should remain in unit tests.

## Authentication and Stellar standards

`@colibri/webauth` implements two distinct Web Authentication flows:

- SEP-10 for classic or muxed accounts, including challenge structure, account
  and memo binding, domains, time bounds, and server-signature validation;
- SEP-45 for contract accounts, including application-provided authorization of
  the complete Soroban entry and enforcing simulation before the challenge is
  returned to the server.

The unified client can select the flow from the requested account type, or an
application can select SEP-10 or SEP-45 explicitly. It does not retry one
protocol as a fallback for the other.

Standard-oriented functionality across the workspace includes:

| Standard | Implementation                                                     |
| -------- | ------------------------------------------------------------------ |
| SEP-1    | `stellar.toml` retrieval and typed discovery in Core               |
| SEP-10   | Classic-account Web Authentication in WebAuth                      |
| SEP-11   | Canonical Stellar asset identifiers in Core                        |
| SEP-23   | StrKey encoding and validation in Core                             |
| SEP-33   | Reference-compatible Stellar identicons in Identicon               |
| SEP-35   | Operation identifiers and TOID helpers in Core                     |
| SEP-41   | Standard token client and version-compatible event schemas in Core |
| SEP-45   | Contract-account Web Authentication in WebAuth                     |
| SEP-58   | Contract build verification in Build Verification                  |

Refer to each package's documentation for its exact version and support
boundary.

## Transaction operations and scaling

The transaction plugins attach policy at stable pipeline boundaries:

- `@colibri/plugin-fee-bump` targets the `send-transaction` step. It wraps the
  completed inner transaction in a fee-bump envelope and authorizes the fee
  source separately.
- `@colibri/plugin-channel-accounts` targets complete classic and contract
  invocation pipelines. It allocates a reusable source account before the
  transaction is built, injects its signer, and releases the account after
  success or failure.

Fee sponsorship and source-account allocation solve different problems and can
be composed. Channel accounts isolate sequences across concurrent submissions;
fee bumps let another account pay the network fee.

## Contract build verification

`@colibri/build-verification` verifies that declared source and build inputs
reproduce the exact Wasm deployed on Stellar or supplied directly. It supports
contract IDs, Wasm hashes, external executable references, and direct Wasm, then
resolves the source and OCI image, runs the build in a bounded Docker container,
selects the declared artifact, and compares the bytes.

The library API and CLI return structured results, logs, and evidence. A
successful comparison establishes build reproducibility and byte equality; it is
not a source-code audit or a statement about contract safety.

## Extension and error contracts

Stable pipeline and step identifiers are public extension points. Plugins can
target a complete pipeline or a specific step without patching transaction
objects at unrelated stages. Custom pipelines can reuse exported processes and
connectors, while domain clients can configure those pipelines behind a
contract- or asset-focused API.

Public workflows use typed error families with stable codes and structured
metadata. Callers should narrow the error type or code for retry, observability,
and user-facing decisions instead of parsing message strings. The
[generated error reference](./docs/reference/errors/README.md) lists the
declared errors by package and context.

## Important boundaries

- `stellar.toml` provides discovery data; retrieving it does not establish trust
  in the domain or its services.
- An identicon is a visual cue, not proof of account ownership and not a
  replacement for checking the complete address.
- A successful transaction proves network acceptance, not application-level
  correctness.
- A successful build verification proves byte equality for the selected inputs,
  not contract safety.
- Secret management remains the responsibility of the signer implementation;
  transaction construction does not require direct access to secret keys.

## Repository layout

```text
core/                         Core package and transaction architecture
build-verification/           Contract build-verification library and CLI
webauth/                      SEP-10 and SEP-45 Web Authentication
rpc-streamer/                 Checkpointed ledger and event ingestion
identicon/                    SEP-33-compatible identicon generation
plugins/fee-bump/             Fee-bump pipeline plugin
plugins/channel-accounts/     Channel-account tools and pipeline plugin
test-tooling/                 Docker-backed Quickstart test infrastructure
docs/                         GitBook guides and generated error reference
_internal/                    Repository-only test fixtures and contracts
_tools/                       Documentation, lint, coverage, and build tooling
```

`_internal/` and `_tools/` are repository infrastructure and are not published
as packages.

## Development

This repository uses Deno workspace tasks from [`deno.json`](./deno.json).

### Tests

```sh
# Unit and integration tests
deno task test

# Unit tests only
deno task test:unit

# Integration tests only
deno task test:integration
```

Integration tests require the external services used by the selected package;
Quickstart-backed tests also require Docker.

### Package checks

```sh
deno lint
deno task check
deno task check:jsr
deno task check:slow-types
deno task check:package-versions
deno task check:crap
```

### Documentation

GitBook content is under [`docs/`](./docs/README.md), with navigation in
[`docs/SUMMARY.md`](./docs/SUMMARY.md).

```sh
# Regenerate the error catalog after changing declared errors
deno task docs:errors

# Test documentation tooling and validate links, navigation, and examples
deno task test:docs
deno task check:docs
```

Complete TypeScript examples use a `<!-- deno-check -->` marker before the code
fence so CI type-checks them without executing external effects.

## License

MIT License. See [LICENSE](./LICENSE).
