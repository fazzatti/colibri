<div align="center">
  <a href="https://jsr.io/@colibri/core" title="@Colibri/core">
    <img alt="@Colibri" src="./_internal/img/colibri-logo-light.png" alt="Colibri Logo" width="300" />
  </a>
  <br />
  <h1>@colibri</h1>
</div>

<p align="center">
  <strong>Start here:</strong> <a href="https://fifo-docs.gitbook.io/colibri">📚 Complete Colibri documentation</a> | <a href="https://github.com/fazzatti/colibri-examples">💡 Runnable examples</a>
</p>

<p align="center">
A TypeScript-first toolkit for building, authenticating, testing, operating, and verifying Stellar applications.
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

The toolkit is designed around a simple idea: application code should be able to
start with a complete, safe workflow without losing access to the Stellar
primitives underneath it. Colibri accepts Stellar SDK operations, transactions,
XDR values, and RPC clients at its boundaries. It adds orchestration and
domain-specific structure around them instead of introducing a parallel model
that an application must constantly translate into and out of.

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

## The angle Colibri brings

The Stellar SDK provides the protocol primitives needed to construct and submit
transactions. Production applications also need to decide when to load an
account sequence, how to carry simulation output into assembly, which signer is
allowed to satisfy which requirement, where fee sponsorship should happen, how
errors cross service boundaries, and how the same workflow can be exercised
against a local ledger. Colibri turns those recurring decisions into explicit,
composable contracts.

- **Workflow without lock-in.** High-level clients and pipelines cover the
  common path, while the same work remains available as individual processes,
  stable steps, connectors, and helpers. Applications can replace one layer
  without reimplementing the rest.
- **Stellar-native inputs and outputs.** Operations and XDR remain Stellar SDK
  objects. Network passphrases, account sequence, Soroban data, authorization
  entries, and envelope signatures stay visible rather than being hidden behind
  an unrelated domain model.
- **Capability-based authorization.** A signer describes what it can do:
  authorize an envelope, authorize a Soroban entry, validate a pre-authorized
  transaction, or combine capabilities. Each signing process narrows the signer
  before using it, so a custom wallet or remote signer can implement only the
  surface it owns.
- **Policy at named boundaries.** Pipelines and steps have stable identifiers.
  Plugins target those boundaries intentionally—for example, fee sponsorship at
  submission or channel allocation around a complete pipeline—rather than
  patching transaction objects at arbitrary points.
- **Failures as API surface.** Public workflows use typed errors with stable
  codes, sources, causes, and structured metadata. Callers can make retry,
  observability, and user-experience decisions without parsing error messages.
- **Standards with explicit limits.** SEP-oriented packages implement a defined
  interoperability surface while keeping security boundaries clear: an identicon
  is not ownership proof, `stellar.toml` is discovery rather than trust, and
  contract authentication remains subject to the contract's own authorization
  logic.

## How the toolkit fits together

Colibri's layers are deliberately usable on their own. Higher layers compose the
lower ones; they do not create a second implementation of the same lifecycle.

```text
Application and protocol packages
  WebAuth | Build Verification | RPC Streamer | transaction plugins
                         │
Domain clients            │        Contract | StellarAssetContract | LedgerEntries
                         │
Pipelines                 │        classic | contract read | contract invoke
                         │
Steps + connectors        │        stable ids + typed state transitions
                         │
Processes                 │        build | simulate | authorize | assemble | sign | send
                         │
Stellar primitives                 SDK operations/XDR | RPC | Horizon | Docker test ledger
```

The transaction pipelines demonstrate the separation:

| Workflow            | Lifecycle                                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classic transaction | Build from SDK operations → derive account and operation signing requirements → apply matching envelope signers → submit and confirm                                       |
| Contract read       | Build an ephemeral transaction → simulate → surface the return value; nothing is signed or submitted                                                                       |
| Contract invocation | Build → recording simulation → authorize Soroban entries → optionally enforce delegated credentials with a second simulation → assemble resources and fees → sign → submit |

Connectors carry typed outputs between these steps and can read earlier step
snapshots from the `convee` run context. The process functions themselves remain
plain TypeScript functions, so custom orchestration does not need to instantiate
a Colibri pipeline merely to reuse fee calculation, simulation, authorization,
assembly, signing, or submission behavior.

Pipelines and steps are callable values as well. Examples name them after the
action—such as `executeClassicTransaction`, `readContract`, or
`invokeContract`—and invoke them directly. Their composition methods, including
`use(...)` for plugins, remain available on the same function value.

### Package composition by system boundary

| Boundary in your application | Packages that fit there                        | Responsibility                                                                                                       |
| ---------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Transaction service          | Core, optionally Fee Bump and Channel Accounts | Build and execute transactions while keeping sponsorship and source-account allocation as composable policy          |
| Contract client              | Core                                           | Load an ABI, read or invoke methods, deploy executables, resolve contract errors, and inspect current ledger entries |
| Login or anchor integration  | Core + WebAuth                                 | Discover advertised endpoints and run explicit SEP-10 or SEP-45 challenge flows                                      |
| Account-facing UI            | Identicon, optionally Core                     | Render a deterministic visual cue while validating and displaying the complete address separately                    |
| Indexer or event consumer    | Core + RPC Streamer                            | Parse typed ledger/event data and maintain archive-to-live ingestion checkpoints                                     |
| Integration test             | Core + Test Tooling                            | Run production-shaped workflows against a disposable Quickstart network                                              |
| Contract release pipeline    | Build Verification                             | Resolve deployed Wasm, reproduce its build in a bounded runner, and retain structured byte-comparison evidence       |

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

The architectural foundation of the toolkit. Core combines Stellar-native
operations and XDR with network profiles, account and signer capabilities,
classic/read/invoke pipelines, contract and Stellar Asset Contract clients,
typed current-state and historical-ledger views, event schemas, SEP-1 discovery,
SEP-11 asset identifiers, and stable error families.

Use the high-level clients for ordinary application code. Use the exported
processes, steps, connectors, signer guards, ledger keys, and XDR helpers when
your application owns part of the orchestration itself.

```sh
deno add jsr:@colibri/core
# or
npx jsr add @colibri/core
```

[View Documentation →](./core/README.md)

---

### [@colibri/webauth](./webauth) <a href="https://jsr.io/@colibri/webauth"><img src="https://jsr.io/badges/@colibri/webauth" alt="JSR @colibri/webauth" /></a>

Unified SEP-10 and SEP-45 Web Authentication. The client can discover the
protocols advertised by a domain and route an account deterministically, or the
application can select the protocol-specific client explicitly. There is no
fallback from one protocol to the other.

SEP-10 verifies the challenge, account/memo binding, domains, time bounds, and
server signature before signing. SEP-45 exposes the complete authorization entry
to application-owned contract logic, then uses enforcing Soroban simulation to
prove that the prepared challenge follows the expected footprint before it is
returned to the server.

```sh
deno add jsr:@colibri/webauth
# or
npx jsr add @colibri/webauth
```

[View Documentation →](./webauth/README.md)

---

### [@colibri/build-verification](./build-verification) <a href="https://jsr.io/@colibri/build-verification"><img src="https://jsr.io/badges/@colibri/build-verification" alt="JSR @colibri/build-verification" /></a>

Reproducible SEP-58 and explicitly labeled out-of-band Stellar contract build
verification. It resolves a deployed contract, Wasm hash, external executable
reference, or direct Wasm; pins the source and OCI image; rebuilds in a bounded
Docker container; selects the artifact without guessing; and compares raw Wasm
bytes.

Use the library API inside release tooling or run its CLI directly from JSR.
Both return structured results and evidence so a caller can distinguish exact
verification, byte mismatch, and a target to which the selected mode does not
apply.

```sh
deno add jsr:@colibri/build-verification
# or
npx jsr add @colibri/build-verification
```

[View Documentation →](./build-verification/README.md)

---

### [@colibri/identicon](./identicon) <a href="https://jsr.io/@colibri/identicon"><img src="https://jsr.io/badges/@colibri/identicon" alt="JSR @colibri/identicon" /></a>

Local, reference-compatible SEP-33 Stellar identicons. A valid `G...` address
produces immutable pattern/color data that can be rendered as SVG, PNG bytes, or
a browser-ready data URL without network, Canvas, DOM, or Node `Buffer`
dependencies.

Use identicons as a visual aid beside the complete address, never as proof of
ownership or a replacement for destination verification.

```sh
deno add jsr:@colibri/identicon
# or
npx jsr add @colibri/identicon
```

[View Documentation →](./identicon/README.md)

---

### [@colibri/plugin-fee-bump](./plugins/fee-bump) <a href="https://jsr.io/@colibri/plugin-fee-bump"><img src="https://jsr.io/badges/@colibri/plugin-fee-bump" alt="JSR @colibri/plugin-fee-bump" /></a>

A step-targeted plugin that adds fee sponsorship without changing the inner
transaction workflow. It intercepts the `send-transaction` boundary, builds the
outer fee-bump envelope, and authorizes the fee source with an envelope or
pre-authorized transaction signer.

Because the plugin acts after inner assembly and signing, application-level
operations and Soroban authorization remain the responsibility of the original
pipeline while a separate account pays the network fee.

```sh
deno add jsr:@colibri/plugin-fee-bump
# or
npx jsr add @colibri/plugin-fee-bump
```

[View Documentation →](./plugins/fee-bump/README.md)

---

### [@colibri/plugin-channel-accounts](./plugins/channel-accounts) <a href="https://jsr.io/@colibri/plugin-channel-accounts"><img src="https://jsr.io/badges/@colibri/plugin-channel-accounts" alt="JSR @colibri/plugin-channel-accounts" /></a>

A pipe-level plugin and lifecycle tool for reusing sponsored Stellar channel
accounts across classic and Soroban submissions. `ChannelAccounts` opens and
closes the on-chain pool; the plugin allocates one source per run, inserts its
signer, and releases it on both success and failure.

Pair it with fee sponsorship when zero-balance channels should submit
immediately. Unlike the Fee Bump plugin, this concern must surround the complete
pipeline because sequence isolation begins before transaction construction.

```sh
deno add jsr:@colibri/plugin-channel-accounts
# or
npx jsr add @colibri/plugin-channel-accounts
```

[View Documentation →](./plugins/channel-accounts/README.md)

---

### [@colibri/rpc-streamer](./rpc-streamer) <a href="https://jsr.io/@colibri/rpc-streamer"><img src="https://jsr.io/badges/@colibri/rpc-streamer" alt="JSR @colibri/rpc-streamer" /></a>

A generic checkpointed ingestion engine with ready-made ledger and contract
event variants. It distinguishes recent live RPC data from older archive RPC
data, paginates both paths, waits at the network head, and transitions from
archive to live ingestion without making the consumer rebuild that control loop.

Use the variants for common ledger/event workloads or supply custom live and
archive ingestors to produce another application data type while preserving the
same lifecycle, checkpoint, and error behavior.

```sh
deno add jsr:@colibri/rpc-streamer
# or
npx jsr add @colibri/rpc-streamer
```

[View Documentation →](./rpc-streamer/README.md)

---

### [@colibri/test-tooling](./test-tooling) <a href="https://jsr.io/@colibri/test-tooling"><img src="https://jsr.io/badges/@colibri/test-tooling" alt="JSR @colibri/test-tooling" /></a>

Docker-backed test infrastructure centered on `StellarTestLedger`. It manages a
named Quickstart container, selected network and service set, readiness,
published endpoints, logs, reuse, stop, and destruction while returning network
details compatible with Core configuration.

Use it when correctness depends on real sequence handling, contract deployment,
simulation, authorization, event emission, or submitted XDR. Keep pure parsing
and conversion in unit tests so the ledger boundary is reserved for behavior a
mock cannot establish.

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

This is progressive disclosure rather than a choice between convenience and
control. `Contract.invoke()` uses the same invocation pipeline that can be
created directly; that pipeline wraps the same exported process functions an
application can call independently.

### Keep authorization mechanisms explicit

Classic envelope signatures and Soroban authorization entries are different
layers. Core models signer capabilities independently and selects only the
capability required by the current step. WebAuth then adds protocol-specific
challenge validation without pretending that every contract authenticates the
same way.

This distinction also permits non-keypair mechanisms such as Hash-X,
signed-payload keys, pre-authorized transactions, and recursive delegated
Soroban authorization without treating every signer as if it exposes a secret
key.

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

### Separate reads, writes, and historical ingestion

Read-only contract calls stop after simulation. State-changing calls assemble,
sign, and submit. Current ledger entries are fetched through typed Core readers,
while closed-ledger traversal and continuous archive-to-live ingestion use the
ledger parser and RPC Streamer. Choosing the correct surface prevents a read
from accidentally becoming a write and prevents current-state APIs from being
used as an incomplete historical index.

### Test at the boundary that matters

Pure conversions and requirements belong in unit tests. Transaction submission,
contract authorization, event emission, and lifecycle behavior belong against a
real ledger. Test Tooling provides a disposable Quickstart boundary so an
application can test the same Core pipeline and XDR behavior it will use on a
public network.

---

## Architecture and extension points

The layers differ by responsibility, not merely by directory:

| Layer          | Owns                                                                                                       | Extend it when...                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Primitives     | Networks, accounts, signer capabilities, assets, identifiers, events, ledger keys, XDR helpers, and errors | You need a new identity, conversion, data view, or protocol-level capability                              |
| Processes      | One deterministic execution unit and its typed error namespace                                             | Your own workflow needs Colibri's implementation of one operation without its orchestration               |
| Steps          | A process wrapped with a stable `convee` id                                                                | Plugins or custom pipelines need a named interception and observation point                               |
| Connectors     | Typed adaptation plus access to prior run snapshots                                                        | The next step needs data from more than the immediately preceding output                                  |
| Pipelines      | The ordered lifecycle and its public input/output                                                          | You need to rearrange or replace lifecycle stages while retaining the same execution units                |
| Domain clients | A developer-facing API that owns and configures one or more pipelines                                      | Repeated calls belong to a contract, asset, or other domain object                                        |
| Packages       | A bounded product or standard integration                                                                  | The concern has its own lifecycle, runtime boundary, or release cadence rather than belonging inside Core |

Stable pipeline and step ids are part of the extension contract. Core's built-in
contract-error matcher targets simulation; the Fee Bump plugin targets the send
step; Channel Accounts targets supported pipelines as a whole. This difference
is intentional: the first two transform behavior at a particular transaction
stage, while channel allocation must surround the complete run and release the
resource on both success and failure.

### Recommended application practices

- Keep one `NetworkConfig` as the source of passphrase and service endpoints,
  and inject an RPC client when the application owns transport configuration.
- Start at the highest abstraction that accurately models the task. Drop down
  for a concrete reason—custom orchestration, an extension boundary, or direct
  access to a primitive—not merely to duplicate pipeline internals.
- Supply signer implementations through capabilities and target matching; avoid
  exposing secret material to transaction-building code.
- Treat recording simulation output as the source for Soroban resources and
  authorization entries. Do not reconstruct those values independently between
  simulation and assembly.
- Attach cross-cutting behavior through documented pipeline or step targets so
  ordering remains visible and testable.
- Narrow `ColibriError` subclasses or stable codes at service boundaries, retain
  the structured cause, and never build control flow around message text.
- Use Test Tooling for ledger-dependent behavior and Build Verification for the
  separate question of whether deployed Wasm reproduces from declared inputs.
- Keep security claims scoped: successful submission proves network acceptance,
  not business correctness; a verified build proves byte equality, not that the
  source is safe.

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

### Package validation

Type-check every public entrypoint, validate its JSR documentation, and ensure
that every published API can be analyzed without slow type inference.

```sh
deno task check
deno task check:jsr
deno task check:slow-types
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
