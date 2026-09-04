# @colibri/core

[📚 Start with the complete Core documentation](https://fifo-docs.gitbook.io/colibri/core/overview)
| [💡 Explore runnable examples](https://github.com/fazzatti/colibri-examples)

Colibri Core is the foundation for building Stellar applications with
TypeScript. It coordinates classic transactions and Soroban calls, but it also
provides the account, signer, contract, asset, ledger, event, network,
identifier, discovery, and error primitives needed around those workflows.

Start with a high-level client or pipeline when its workflow fits. Move down to
individual processes, steps, ledger keys, XDR helpers, or authorization tools
when your application needs a custom composition. Both levels use the same
public types and typed error model.

<a href="https://jsr.io/@colibri/core">
  <img src="https://jsr.io/badges/@colibri/core" alt="JSR @colibri/core" />
</a>
<a href="https://jsr.io/@colibri/core">
  <img src="https://jsr.io/badges/@colibri/core/total-downloads" alt="JSR total downloads for @colibri/core" />
</a>

## Installation

Colibri Core is published on [JSR](https://jsr.io/@colibri/core) and ships
entirely as TypeScript modules. Deno `v2.0` or later is supported directly;
Node.js consumers should use `v22.12` or later, matching the minimum runtime of
the underlying Stellar SDK 17 dependency.

```sh
# Deno (JSR)
deno add jsr:@colibri/core

# Node.js / bundlers
npx jsr add @colibri/core
```

After installation, import from the package root (`jsr:@colibri/core`).
Published exports are declared in `core/deno.json`, ensuring compatibility with
Deno, Node, and bundlers.

## What Core helps you build

The package root exposes the complete supported API. This map gives each family
a small introduction before the later sections explain how the pieces work.

| Area                          | What it provides                                                                                                                          | Typical use                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Transactions and pipelines    | Classic submission, read-only contract simulation, state-changing contract invocation, fee strategies, memos, preconditions, and plugins  | Send a payment, call a contract, cap a Soroban fee, or insert application policy               |
| Contracts                     | ABI/spec loading, typed method arguments, reads, invocations, deployment, error metadata, Wasm hashes, and external executable references | Build a client around an existing contract or deploy one from Wasm                             |
| Assets                        | SEP-11 canonical asset strings and a high-level Stellar Asset Contract client                                                             | Validate asset identifiers, derive an SAC, manage trustlines, or invoke token methods          |
| Accounts and signers          | Native and muxed account identities plus Ed25519, HashX, signed-payload, pre-authorized, and delegated signing capabilities               | Keep envelope and Soroban authorization requirements explicit                                  |
| Ledger entries and inspection | Typed current-state reads plus lazy views over ledgers, transactions, operations, and execution metadata                                  | Inspect accounts, trustlines, contract state, executable code, fees charged, or historical XDR |
| Events                        | Event IDs, filters, ledger-meta parsing, schema-driven templates, and ready-made SAC, SEP-41, and CAP-67 event models                     | Decode contract output, build filters, or create a typed event model                           |
| Networks and discovery        | Mainnet, Testnet, Futurenet, and custom configurations; provider helpers; Friendbot; and SEP-1 `stellar.toml` parsing                     | Keep passphrases and endpoints together or discover an integration from its domain             |
| Addresses and identifiers     | SEP-23 StrKey format/checksum guards, muxed-address normalization, ledger keys, and SEP-35 operation IDs                                  | Validate untrusted identifiers and index exact operations                                      |
| Errors and utilities          | Stable error namespaces, assertions, binary normalization, ScVal/XDR conversion, auth inspection, caches, and type guards                 | Build reliable application boundaries without duplicating low-level traversal                  |

Core deliberately does not hide the underlying Stellar SDK. Operations and XDR
values remain SDK objects, while Colibri handles the repeated coordination
around them. Protocol-specific products build on Core in separate packages—for
example, use [`@colibri/webauth`](https://jsr.io/@colibri/webauth) for complete
SEP-10 or SEP-45 web-authentication flows and
[`@colibri/rpc-streamer`](https://jsr.io/@colibri/rpc-streamer) for continuous
ingestion.

## Core's design contract

Core is an orchestration toolkit around Stellar, not a replacement protocol
model. The following constraints shape its public API:

1. **Stellar values cross the boundary unchanged.** You create operations with
   the Stellar SDK and can continue inspecting transaction envelopes, XDR
   unions, simulation responses, and RPC results with the SDK. Colibri adds
   typed configuration and lifecycle coordination around those values.
2. **Each layer has one responsibility.** Processes perform work, steps give
   processes stable runtime identities, connectors adapt state, pipelines define
   order, and clients expose a domain-oriented interface over those pipelines.
3. **Signing is capability-based.** Envelope authorization, Soroban
   authorization-entry signing, and pre-authorized transaction validation are
   separate interfaces. A pipeline checks the capability it needs instead of
   assuming every signer is an in-memory Ed25519 keypair.
4. **Soroban recording and enforcement are distinct.** The first simulation
   discovers resources and authorization. Delegated credentials, when present in
   the signed operation XDR, trigger the intermediate assembly and enforcing
   simulation required before final assembly. Ordinary authorization does not
   pay for or wait on that second simulation.
5. **Extension points are named.** Pipeline and step ids are stable public
   integration seams. A plugin declares where it acts, making ordering and
   ownership reviewable instead of relying on an implicit callback chain.
6. **Failures preserve context.** Expected and wrapped failures use typed
   `ColibriError` families with stable codes and metadata. Higher layers may add
   context, but they do not require callers to reverse-engineer a string.
7. **Convenience remains inspectable.** High-level objects such as `Contract`
   own their read and invoke pipelines publicly. You can attach a compatible
   plugin or move to the underlying pipeline/process without abandoning the
   types used by the client.

This structure is meant to support gradual adoption. A script can use a single
helper; an application can use the built-in pipelines; and an infrastructure
service can compose the exported steps and processes into a workflow with its
own storage, signing, or policy boundaries.

## How transaction data moves

The built-in pipelines share execution units but stop at different points. That
prevents a read from accidentally becoming a submitted transaction and keeps the
additional work of Soroban invocation explicit.

| Stable step                         | Classic | Contract read | Contract invoke | Responsibility                                                                                     |
| ----------------------------------- | :-----: | :-----------: | :-------------: | -------------------------------------------------------------------------------------------------- |
| `build-transaction`                 |    ✓    |       ✓       |        ✓        | Resolve source sequence, operations, time bounds, memo, preconditions, and initial fee             |
| `simulate-transaction`              |         |       ✓       |        ✓        | Ask RPC to record contract result, resources, footprint, and required authorization                |
| `sign-auth-entries`                 |         |               |        ✓        | Match each address credential to one capable signer and return the complete signed entry           |
| `assemble-for-enforcement`          |         |               |   conditional   | Materialize an intermediate transaction only when signed delegated credentials require enforcement |
| `enforce-simulation`                |         |               |   conditional   | Re-simulate delegated authorization and obtain the enforced Soroban data                           |
| `assemble-transaction`              |         |               |        ✓        | Apply final Soroban data, signed entries, resource fee, and explicit fee strategy                  |
| `envelope-signing-requirements`     |    ✓    |               |        ✓        | Resolve source and operation-level account requirements after the transaction shape is final       |
| `sign-envelope`                     |    ✓    |               |        ✓        | Select unambiguous matching envelope/pre-authorized signers and satisfy exact extra-signer keys    |
| `send-transaction`                  |    ✓    |               |        ✓        | Submit through RPC and wait for a normalized terminal result                                       |
| `parse-classic-transaction-outcome` |    ✓    |               |                 | Extract ordered runtime-discriminated operation outcomes and the charged fee                       |

Typed connectors form the transitions. They can combine the immediately
preceding output with an earlier step snapshot—for example, final assembly uses
the original built transaction, the signed authorization entries, the relevant
simulation data, and the configured fee strategy. The run context holds this
state inside one pipeline execution; callers do not maintain a parallel bag of
intermediate values.

Soroban and envelope authorization remain separate phases:

```text
recording simulation
  → address authorization requirements
  → AuthEntrySigner capabilities
  → optional delegated enforcement
  → final transaction assembly
  → account/operation envelope requirements
  → EnvelopeSigner or PreAuthTransactionSigner capabilities
  → submission
```

The current envelope process requires one unambiguous signer key for each
resolved account requirement; it does not aggregate signer weights into a
general multisig solver. Account threshold information remains available to
applications that implement a custom multisig policy.

## Choose the right abstraction

| Start with...                        | When you need...                                                                                                 | What remains available                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `Contract` or `StellarAssetContract` | A domain client that encodes methods, owns read/invoke pipelines, and can load ABI or contract-error information | The owned `readPipe` and `invokePipe`, raw invocation methods, contract spec, Wasm, and ledger keys |
| `LedgerEntries`                      | Typed current-state reads for accounts, trustlines, offers, contract data/code, configuration, or TTL            | Exact ledger keys, raw XDR, decoded discriminated unions, and the RPC client boundary               |
| A built-in pipeline                  | A complete classic, read-only, or state-changing transaction lifecycle                                           | Stable steps, plugin targets, run output, Stellar transactions, simulation data, and RPC responses  |
| An exported process                  | One tested execution unit inside application-owned orchestration                                                 | Typed input/output and a process-specific error namespace                                           |
| Steps and connectors                 | A custom `convee` pipeline with Colibri-compatible observation and plugin boundaries                             | The same process functions and stable ids used by built-in pipelines                                |
| Primitives and helpers               | Independent address, asset, event, auth, identifier, binary, ScVal, XDR, or network behavior                     | No pipeline or client lifecycle is required                                                         |

## Quick start: send a Testnet payment

This complete example creates two disposable identities, funds them with
Friendbot, and sends one test XLM. Save it as `payment.ts` and run
`deno run --allow-net payment.ts`. It writes only to Testnet.

<!-- deno-check -->

```ts
import {
  createClassicTransactionPipeline,
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { Asset, Operation } from "npm:@stellar/stellar-sdk@^17.0.1";

const network = NetworkConfig.TestNet();
const sender = LocalSigner.generateRandom();
const recipient = LocalSigner.generateRandom();

try {
  for (const signer of [sender, recipient]) {
    await initializeWithFriendbot(network.friendbotUrl, signer.publicKey(), {
      rpcUrl: network.rpcUrl,
      allowHttp: network.allowHttp,
    });
  }

  const executeClassicTransaction = createClassicTransactionPipeline({
    networkConfig: network,
  });
  const result = await executeClassicTransaction({
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

  console.log("Confirmed transaction:", result.hash);
} finally {
  sender.destroy();
  recipient.destroy();
}
```

`fee: "100"` is a base fee in stroops, not 100 XLM. The classic pipeline loads
the source sequence, builds the transaction, resolves envelope requirements,
signs it, submits it through RPC, and waits for confirmation. It does not run
Soroban resource simulation because this payment contains no host function. For
application code, keep signers out of logs and destroy in-memory signers when
their lifecycle ends.

Continue with
[the complete Core guides](https://fifo-docs.gitbook.io/colibri/core/overview),
the [Colibri examples](https://github.com/fazzatti/colibri-examples), or the
focused sections below.

The quick start above is a standalone script. The shorter TypeScript blocks in
the reference-oriented sections below are focused fragments: names such as
`networkConfig`, `config`, `operations`, `contractId`, `metadataXdr`, `filters`,
and `plugin` are supplied by the surrounding application. Follow the linked
guides and examples when you need a complete runnable workflow.

## Recommended practices

### Keep network identity together

Pass a `NetworkConfig` through clients and pipelines so the network passphrase,
RPC/Horizon endpoints, HTTP policy, archive RPC, and Friendbot availability
cannot drift independently. Inject an already configured Stellar RPC `Server`
when transport, headers, connection reuse, or testing belongs to the
application. Never infer the signing passphrase from an RPC URL.

### Choose fees by intent

`TransactionConfig.fee` accepts a string for the Stellar SDK's familiar
per-operation base-fee behavior, or one explicit strategy:

| Configuration                | Meaning                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `"100"` or `{ base: "100" }` | Base fee per operation; the transaction builder derives the inclusion bid from its operation count                  |
| `{ inclusion: "500" }`       | Exact inclusion-fee bid for the transaction                                                                         |
| `{ max: "100000" }`          | Maximum complete fee; after simulation, Core reserves the resource fee and uses only the remainder as inclusion fee |

For a Soroban maximum, the configured value must leave at least the minimum
network inclusion fee after the simulated resource fee is subtracted. Core
performs that validation during assembly, when the actual resource value is
known. If an application must override simulated Soroban data itself, that is a
custom assembly concern rather than another `TransactionConfig` field.

### Treat signers as scoped capabilities

Pass only the signer objects required by the run, and use `signsFor(...)` to
make target ownership explicit. Keep secrets inside their signer implementation;
transaction construction should not know how a wallet, HSM, remote service,
Hash-X preimage, signed payload, or delegated contract produces authorization.
Destroy `LocalSigner` and `HashXSigner` instances when their retained secret
material is no longer required.

### Extend the narrowest stable boundary

Use a process when you own orchestration, a step-targeted plugin when policy
belongs immediately before/after one operation, and a pipe-targeted plugin when
it must surround the complete lifecycle. Attach invoke-only and read-only
plugins separately on `Contract`; a policy appropriate for submitted writes may
be incorrect for simulations.

### Use the right data surface

- Use `LedgerEntries` for typed values that exist at the RPC server's current
  ledger state.
- Use `Ledger`/`Transaction`/`Operation` parser views when processing a specific
  closed ledger and its metadata.
- Use `RPCStreamer` from its separate package when you need checkpoints,
  pagination, archive recovery, and a continuing archive-to-live loop.

These APIs intentionally do not pretend that current state, one historical
ledger, and an unbounded data stream have the same consistency or retention
model.

### Handle errors structurally

Narrow a concrete error class or stable code, log its `source` and structured
metadata, and retain its cause. Message text is for humans and can improve
without becoming a breaking control-flow contract. When custom infrastructure
throws an unknown value, wrap it with `ColibriError.fromUnknown(...)` at the
boundary that can add useful context.

### Test the assembled workflow

Unit-test pure requirements, parsing, and conversion logic. Exercise sequence
loading, RPC simulation, authorization, resource assembly, envelope signing,
submission, events, and cleanup against a real local ledger with
`@colibri/test-tooling`. A mocked success response cannot establish that the
assembled XDR is accepted by Stellar.

## Architecture overview

- **Deterministic errors** – Every recoverable failure is a named `ColibriError`
  subclass with a domain, code, metadata payload, and JSON representation you
  can rely on when monitoring or retrying. See [Error system](#error-system).
- **Pipelines** – High-level orchestrators built with `convee`, wiring steps and
  shared connectors into repeatable flows for Soroban contract invocation,
  read-only simulations, and classic transactions. See [Pipelines](#pipelines).
- **Processes** – Focused raw functions (build, simulate, authorize, assemble,
  sign, send) you can call directly or wrap in your own steps. See
  [Processes](#processes).
- **Steps** – Thin `convee` wrappers around processes that provide stable ids
  and plugin targets. See [Pipelines](#pipelines).
- **Core plugins** – Built-in extension points for Colibri pipeline steps, such
  as known contract-error matching during simulation. See
  [Core plugins](#core-plugins).
- **Accounts and signers** – Strongly typed wrappers around Ed25519 identities,
  muxed accounts, ledger keys, and signing. See
  [Accounts & signers](#accounts--signers).
- **Contracts and assets** – High-level contract lifecycle and Stellar Asset
  Contract APIs over the same read/invoke pipelines. See
  [High-level contract clients](#high-level-contract-clients).
- **Current and historical state** – Typed ledger-entry reads and lazy ledger,
  transaction, and operation views. See [Ledger entries](#ledger-entries) and
  [Ledger parser](#ledger-parser).
- **Discovery and asset identifiers** – SEP-1 `stellar.toml` retrieval and
  SEP-11 asset strings for interoperable service and asset configuration. See
  [Discovery and canonical assets](#discovery-and-canonical-assets).
- **Events** – Tools for parsing, filtering, and working with Soroban contract
  events from ledger metadata. See [Events](#events).
- **TOID** – Utilities for working with SEP-0035 operation IDs for precise
  operation indexing. See [TOID](#toid).
- **Network configuration** – Type-safe network profiles with runtime validation
  and type narrowing. See [Network configuration](#network-configuration).
- **Common modules** – Shared configuration types, validators, StrKey utilities,
  auth rules, address helpers, and pipeline connectors that keep every layer
  aligned. See [Common modules](#common-modules).

Use the high-level pipelines when you want an opinionated flow. Drop down to
processes, steps, or utilities when you need bespoke orchestration or
integration with external services.

## Error system

The error layer is the backbone of Colibri Core. Every error extends the base
`ColibriError`, which standardizes:

- `domain` – logical area (`pipelines`, `processes`, `tools`, `common`, etc.).
- `code` – stable identifier (`PIPE_INVC_002`, `SIM_004`, …) that you can log,
  match on, or promote to analytics.
- `source` – which module raised the error.
- `details` and `diagnostic` – human-readable stack or diagnostic object.
- `meta` – structured payload (often the input that caused the failure) so
  consumers can inspect context programmatically.

Each module exports its own subclasses. Example:

```ts
import { ColibriError, ERROR_PIPE_INVC } from "jsr:@colibri/core";

try {
  await executeTransaction(input);
} catch (err) {
  if (err instanceof ERROR_PIPE_INVC.MISSING_ARG) {
    // handle a known configuration issue
  } else if (ColibriError.is(err)) {
    console.error(err.code, err.meta);
  } else {
    throw err;
  }
}
```

Key guarantees:

- **Uniqueness** – Codes are unique within their domain. You can use them as
  keys in retry logic or UX flows.
- **Type safety** – Error constructors attach typed `meta`, so narrowing via
  `instanceof` yields structured data without casting.
- **JSON friendliness** – `ColibriError.toJSON()` returns a stable schema,
  allowing you to serialize errors across process boundaries.

When wrapping unexpected exceptions, use
`ColibriError.fromUnknown(error, context)` or `ColibriError.unexpected()` to
preserve the original cause while emitting a Colibri-shaped error.

## Pipelines

Pipelines combine `convee` steps and shared connectors into end-to-end
transaction flows. Colibri keeps a clear boundary:

The value returned by a pipeline factory is itself callable. Give it a name that
describes the action and invoke it directly—for example,
`await invokeContract(input)`—instead of treating it as a wrapper that requires
`.run(...)`. Methods such as `use(...)` remain available on the same callable
value for plugin composition.

- **Processes** are plain functions with typed inputs, outputs, and error
  namespaces.
- **Steps** are `convee` wrappers with stable ids, such as
  `steps.createBuildTransactionStep()`.
- **Connectors** adapt one step boundary to the next. Shared ones live under
  `core/pipelines/shared/connectors`, while pipeline-specific ones stay next to
  the owning pipeline.

Pipelines are built with `pipe(...)` and `step(...)` from `convee`, and plugins
target step ids such as `steps.SEND_TRANSACTION_STEP_ID`.

### Soroban invocation

`createInvokeContractPipeline({ networkConfig })` runs the full Soroban write
path:

1. Build the transaction (`BuildTransaction`).
2. Run recording simulation (`SimulateTransaction`).
3. Sign Soroban authorization entries (`SignAuthEntries`).
4. Assemble delegated auth for enforcement when present
   (`AssembleForEnforcement`).
5. Run enforcing simulation when delegated auth is present
   (`EnforceSimulation`).
6. Assemble the final transaction (`AssembleTransaction`).
7. Determine signing requirements (`EnvelopeSigningRequirements`).
8. Apply available envelope signers (`SignEnvelope`).
9. Submit via RPC (`SendTransaction`).

The enforcement steps infer their behavior from operation XDR. Ordinary
transactions pass through them without a second RPC simulation.

Output includes the RPC submission response, transaction hash, and the Soroban
return value decoded to `xdr.ScVal`. Connectors use `convee` run context to
access prior step outputs where needed, instead of the old metadata helper
pattern.

```ts
const invokeContract = createInvokeContractPipeline({ networkConfig });
const result = await invokeContract({ operations, config }); // config: TransactionConfig
```

### Read-only Soroban access

`createReadFromContractPipeline` builds a temporary transaction with an
ephemeral account, runs simulation, and surfaces the `returnValue` without
submitting anything. Use it for contract getters or diagnostics. The simulation
response is preserved so you can review resource usage and footprints.

### Classic transaction submission

`createClassicTransactionPipeline` is the classic counterpart: it builds,
computes signature requirements, signs, and submits classic operations
(payments, set options, etc.), reusing the same `TransactionConfig` shape as
Soroban flows so you can share configuration between the two modes. Its output
includes the fee actually charged and ordered, runtime-discriminated successful
operation outcomes. Narrow an outcome's `type` to access its corresponding
Stellar SDK XDR result, such as a created claimable-balance ID or an offer's
created, updated, or deleted effect.

## Processes

Processes are reusable building blocks exported from `jsr:@colibri/core`. They
are plain functions, which makes them easy to test directly and easy to reuse
outside Colibri's built-in pipelines.

- **BuildTransaction** – Creates transactions with optional memo, preconditions,
  either RPC-derived or explicit sequence numbers, and string base fees or
  explicit base, inclusion, and maximum fee strategies.
- **SimulateTransaction** – Wraps `Server.simulateTransaction`, producing typed
  success/restore responses and raising specific errors for transport failures,
  generic simulation failures, parsed contract errors, or unrecognized payloads.
- **SignAuthEntries** – Consumes simulated Soroban auth entries alongside a set
  of `Signer`s, narrowing them to the authorization-entry capability and
  returning complete authorized entries in the order Soroban expects.
- **AssembleForEnforcement** – Builds the intermediate transaction needed to
  enforce completed delegated credentials.
- **EnforceSimulation** – Runs the second simulation for delegated credentials
  and passes ordinary transactions through without an RPC call.
- **AssembleTransaction** – Merges the base transaction, signed auth entries,
  and simulated Soroban data into a ready-to-sign transaction. Resource fees
  come from that data and are combined with the configured inclusion fee or
  total maximum exactly once.
- **EnvelopeSigningRequirements** – Analyzes both envelope and Soroban
  source/operation requirements, yielding the account checklist used for final
  envelope authorization. Soroban authorization entries are handled earlier by
  `SignAuthEntries`.
- **SignEnvelope** – Deterministically resolves account and exact extra-signer
  requirements, then applies envelope signatures or verifies pre-authorized
  transaction hashes.
- **SendTransaction** – Submits the envelope (classic or fee-bump) via RPC and
  normalizes RPC responses into Colibri errors when failures occur.
- **ParseClassicTransactionOutcome** – Unwraps direct and fee-bump success
  results into ordered, runtime-discriminated Stellar XDR operation outcomes and
  exposes the total fee charged.

Each process is exported as a function plus an error namespace. Example:

```ts
import { BTX_ERRORS, buildTransaction } from "jsr:@colibri/core";

const transaction = await buildTransaction(input);
```

When you need orchestration ids or plugin targets, use the matching step factory
from `jsr:@colibri/core`.

## Core plugins

Core plugins are shipped with `@colibri/core` and attach to built-in pipeline
steps with the callable pipeline's `use(...)` method.

The contract error matcher targets the `simulate-transaction` step. It rewrites
recognized `CONTRACT_ERROR_SIMULATION_FAILED` errors into
`KNOWN_CONTRACT_ERROR_SIMULATION_FAILED` with a message from your contract error
map while keeping the original simulation failure in `meta.cause`. Error maps
can also include optional `details`, which Colibri surfaces in the diagnostic
root cause. When a diagnostic stack contains multiple contract errors, the
matcher only rewrites the error code surfaced by RPC and uses the stack to find
the matching contract, root/sub-invocation marker, and event index.

```ts
import {
  createContractErrorMatcherPlugin,
  createInvokeContractPipeline,
} from "jsr:@colibri/core";

const invokeContract = createInvokeContractPipeline({ networkConfig });

invokeContract.use(
  createContractErrorMatcherPlugin({
    1: {
      message: "Unauthorized",
      details: "The caller is not authorized to run this operation.",
    },
  }),
);
```

For the high-level `Contract` client, call
`contract.loadContractErrorsFromWasm(...)` to derive the mapping from the loaded
spec or WASM and install the matcher on both `readPipe` and `invokePipe`. If you
need constructor-time setup, pass plugins intentionally through
`contractConfig.plugins`.

## Contract executables

The high-level `Contract` client accepts exactly one executable source: `wasm`,
`wasmHash`, `contractId`, or a CAP-85 `externalRef`. External references use the
Stellar SDK owner/tag shape and deploy through the same invocation pipeline as
direct Wasm hashes:

```ts
const contract = new Contract({
  networkConfig,
  contractConfig: {
    externalRef: { owner: "COWNER...", tag: "stable" },
  },
});

await contract.loadSpecFromNetwork();
await contract.deploy({ config });
```

`loadSpecFromNetwork()` also accepts a deployed `contractId`. It distinguishes
direct Wasm, Stellar Asset Contracts, and external references, resolving the
current owner/tag mapping when necessary. Calling it again deliberately
refreshes a mutable external mapping instead of treating an earlier resolved
hash as permanent.

The same behavior is available at the ledger layer through
`LedgerEntries.resolveContractExecutable(...)` and
`LedgerEntries.contractCode({ contractId })`. Resolution returns the raw
external owner/tag, the Wasm hash observed at that moment, and relevant ledger
observations. Colibri does not impose a manager-contract design; applications
can manage mappings through ordinary contract invocation.

## Accounts & signers

### NativeAccount

`NativeAccount` encapsulates Stellar public keys with assertive validation and
helpers commonly needed in Soroban contexts:

- `NativeAccount.fromAddress(publicKey)` – validated instantiation without
  signer.
- `NativeAccount.fromMasterSigner(keypairSigner)` – binds a keypair signer so
  pipelines can discover it automatically.
- `address()` – returns the Ed25519 public key.
- `muxedAddress(muxedId)` – produces a muxed account string with checksum
  validation.
- `getAccountLedgerKey()` / `getTrustlineLedgerKey(asset)` – generates typed
  ledger keys for state queries.

All methods throw predictable `ColibriError` subclasses when validation fails,
ensuring upstream workflows can safely recover.

### Signer capabilities

`LocalSigner` is an in-memory Ed25519 signer that keeps the secret key within a
closure (never on the instance), supports classic transaction signatures,
Soroban authorization signatures, and exposes a `destroy()` method plus
`[Symbol.dispose]()` to zero sensitive buffers on cleanup.

```ts
const signer = LocalSigner.fromSecret(secret);
signer.signTransaction(transaction);
await signer.signSorobanAuthEntry(entry, validUntil, passphrase);
```

`EnvelopeSigner` and `AuthEntrySigner` are independent capabilities. `Signer`
also accepts the distinct `PreAuthTransactionSigner` capability, and each
signing process uses the matching `isEnvelopeSigner(...)`,
`isPreAuthTransactionSigner(...)`, or `isAuthEntrySigner(...)` guard before
invoking it. `KeypairSigner` describes the complete Ed25519 surface implemented
by `LocalSigner`, including detached payload signing and public-key access.

Envelope authorizers expose their exact `signerKey()`. Colibri includes built-in
`HashXSigner`, `Ed25519SignedPayloadSigner`, and
`PreAuthorizedTransactionSigner` implementations. Alternative account signer
mechanisms require an explicit `addTarget(account)`, while transaction
`extraSigners` are matched directly by signer key.

`DelegatedSigner` implements the authorization-entry capability for CAP-71. It
owns an externally assembled recursive `nestedDelegates` topology, applies the
same full-entry signing method at every node, and returns one completed
delegated authorization entry. Only the top-level instance belongs in the
Soroban transaction's signer list.

## High-level contract clients

### Contract

`Contract` is the flexible Soroban client when you want to work directly with a
known contract id, wasm, or deployed contract metadata. It exposes its
`invokePipe` and `readPipe` publicly, which makes it the right seam for advanced
pipeline plugin composition.

Configure exactly one executable source:

- `contractId` binds to an existing deployment.
- `wasm` keeps exact contract bytes available for upload, deployment, spec
  loading, and contract-error metadata.
- `wasmHash` deploys code that is already present on the network.
- `externalRef` addresses the executable by its CAP-85 owner/tag reference and
  resolves the current Wasm when network access is needed.

Load a contract specification before using named `methodArgs`. For a deployed
contract, `loadSpecFromNetwork()` resolves ordinary Wasm and external references
and deliberately refreshes mutable mappings on later calls. Then choose `read()`
for simulation-only access or `invoke()` for a signed, submitted write. The
corresponding `readRaw()` and `invokeRaw()` methods accept already encoded
ScVals. Deployment uses the same transaction configuration and supports
constructor arguments when the contract spec declares them.

Contract error metadata is opt-in: `loadContractErrorsFromWasm()` extracts the
contract's error map and installs the matcher on both owned pipelines. This can
turn a numeric simulation failure into a typed error with the contract's message
without changing the on-chain result.

## Ledger entries

`LedgerEntries` provides typed RPC reads for well-known Stellar ledger entries
without forcing callers to assemble `LedgerKey` XDR or manually walk the
returned entry XDR.

```ts
const ledger = new LedgerEntries({ networkConfig });

const account = await ledger.account({ accountId });
const trustline = await ledger.trustline({ accountId, asset });
const instance = await ledger.contractInstance({ contractId });

account.balance;
trustline.limit;
instance.executable;
instance.xdr; // parsed RPC entry for advanced inspection
```

For lower-level workflows, the branded key builders remain available as
standalone exports and still return plain `xdr.LedgerKey` values at runtime:

```ts
const [account, config] = await ledger.getMany(
  [
    buildAccountLedgerKey({ accountId }),
    buildConfigSettingLedgerKey({
      configSettingId: "configSettingContractMaxSizeBytes",
    }),
  ] as const,
);
```

### SEP41TokenContract

`SEP41TokenContract` binds any deployed SEP-41 token to the exact standard
interface without requiring its contract specification:

```ts
const token = new SEP41TokenContract({ networkConfig, contractId });

const balance = await token.balance({ id: holder });
await token.transfer({
  from: holder,
  to: recipient,
  amount: 10_000_000n,
  config: txConfig,
});
```

The client includes allowance, transfer, burn, and descriptive metadata methods.
`transfer` accepts muxed destinations. Minting, clawback, and administrator
methods are not part of SEP-41 and are intentionally absent. Custom token
functions remain accessible through `token.contract.readRaw()` or
`token.contract.invokeRaw()` with explicitly encoded ScVals.

### StellarAssetContract

`StellarAssetContract` is the domain-specific client for CAP-0046-06 Stellar
Asset Contracts. Preferred entry points are the static factories:

```ts
const existing = StellarAssetContract.fromContractId({
  networkConfig,
  contractId,
});

const derived = StellarAssetContract.fromAsset({
  networkConfig,
  code: "USDC",
  issuer,
});

const deployed = await StellarAssetContract.deploy({
  networkConfig,
  code: "USDC",
  issuer,
  config: txConfig,
});
```

Use `trust(...)` to create an unlimited trustline on a classic Stellar account
before sending the asset to that account:

```ts
await existing.trust({
  address: holderAddress,
  config: txConfig,
});
```

`options.cache` configures memoization for stable descriptive reads
(`decimals()`, `name()`, and `symbol()`). The same shared cache shape is reused
across high-level tools:

```ts
const sac = StellarAssetContract.fromContractId({
  networkConfig,
  contractId,
  options: {
    cache: {
      enabled: true,
      ttl: 60_000,
    },
  },
});
```

For advanced plugin usage, attach plugins directly to the owned invoke pipe:

```ts
sac.contract.invokePipe.use(plugin);
```

## Ledger parser

`LedgerEntries` reads current state by ledger key. The separate `Ledger`,
`Transaction`, and `Operation` parser classes inspect ledger-close data returned
by RPC `getLedgers()`. They lazily decode and memoize XDR so callers can move
from a ledger to its transactions and operations without eagerly parsing every
field.

The parser distinguishes envelope data from result metadata. Check
`transaction.hasEnvelope` before reading envelope-only fields; a transaction
constructed from result metadata alone still exposes its outcome but cannot
invent a source, sequence, or operation list. `transaction.fee` is the fee
charged in the execution result, not the fee bid from the original envelope.

These classes do not query RPC or stream new ledgers. Pair them with an RPC
client for individual ranges or with `@colibri/rpc-streamer` for continuous
live/archive ingestion. They are also distinct from the Stellar SDK's
transaction and operation builder APIs, so alias imports when using both.

## Events

Colibri Core provides utilities for working with Soroban contract events,
including parsing from ledger metadata and filtering.

### Event parsing

Parse contract events directly from `LedgerCloseMeta` XDR structures:

```ts
import { parseEventsFromLedgerCloseMeta } from "jsr:@colibri/core";

await parseEventsFromLedgerCloseMeta(
  metadataXdr, // LedgerCloseMeta XDR string
  async (event) => {
    // EventHandler callback
    console.log(event);
  },
  filters, // optional EventFilter[]
);

// Each event includes:
// - id: unique event identifier
// - type: "contract" | "system"
// - ledger: ledger sequence number
// - contractId: the emitting contract (with address helper)
// - topic: decoded topic values
// - value: the event payload
```

### Event filtering

Create filters to select specific events by type, contract, or topic patterns:

```ts
import { EventFilter, EventType } from "jsr:@colibri/core";
import { xdr } from "npm:@stellar/stellar-sdk";

const filter = new EventFilter({
  type: EventType.Contract,
  contractIds: ["CABC..."],
  topics: [
    [xdr.ScVal.scvSymbol("transfer"), "*", "*", "*"],
    [xdr.ScVal.scvSymbol("mint"), "**"],
  ],
});

// Convert to RPC-compatible format
const rawFilter = filter.toRawEventFilter();
```

**Topic wildcards:** `"*"` matches one segment; terminal `"**"` matches the
remaining topic suffix. Use a complete topic pattern for a known event schema.

### Ledger metadata utilities

Helper functions for working with ledger close metadata:

```ts
import { isLedgerCloseMetaV1, isLedgerCloseMetaV2 } from "jsr:@colibri/core";

// Type guards for metadata versions
if (isLedgerCloseMetaV2(meta)) {
  // access V2-specific fields like txProcessing
}
```

### Typed and standardized events

Extend `EventTemplate` with a schema to validate decoded events, expose typed
fields, and derive topic filters from one definition. Core also exports
ready-made event classes through:

- `SACEvents` for the events emitted by Stellar Asset Contracts.
- `SEP41Events` for the SEP-41 token event surface.
- CAP-67 event helpers for the current classic-operation event model.

Use the matching family for the contract or protocol that produced the event. A
topic name that looks familiar is not enough to reinterpret one standard's
payload as another.

SEP-41 parsers accept both the earlier scalar/vector data and the current
symbol-keyed map format. Standard fields remain typed; unknown map fields are
preserved under `extensions` and can be transformed through an
application-provided runtime decoder.

## TOID

The TOID helpers work with SEP-0035 operation IDs. Colibri uses the `TOID` type
name for these 64-bit identifiers, but SEP-0035 itself names the scheme
"Operation IDs".

A TOID identifies one historical operation. It is related to, but distinct from,
Colibri's `EventId`, which appends an event index to the operation ID.

### Creating TOIDs

```ts
import { createTOID } from "jsr:@colibri/core";

const toid = createTOID(
  12345678, // ledgerSequence
  1, // transactionOrder, 1-based
  1, // operationIndex, 1-based
);

console.log(toid); // "0053024283256950784"
```

### Parsing TOIDs

```ts
import { parseTOID } from "jsr:@colibri/core";

const components = parseTOID("0053024283256950784");
// {
//   ledgerSequence: 12345678,
//   transactionOrder: 1,
//   operationIndex: 1
// }
```

### Ledger bounds

```ts
import { createTOID } from "jsr:@colibri/core";

const ledger = 12345678;
const firstToid = createTOID(ledger, 1, 1);
const lastToid = createTOID(ledger, 1048575, 4095);
```

### TOID structure

TOIDs pack three values into a 64-bit integer:

| Field                         | Bits | Description                                      |
| ----------------------------- | ---- | ------------------------------------------------ |
| Ledger sequence               | 32   | The ledger number                                |
| Transaction application order | 20   | Position of the transaction in the closed ledger |
| Operation index               | 12   | Operation index within transaction               |

This structure gives historical operations deterministic order after the ledger
has closed. A transaction's application order is not knowable before inclusion
in a closed ledger.

## Network configuration

Network configuration in Colibri Core uses a class-based approach with static
factory methods and runtime type narrowing.

### Creating configurations

```ts
import { NetworkConfig } from "jsr:@colibri/core";

// Pre-configured networks
const testnet = NetworkConfig.TestNet();
const futurenet = NetworkConfig.FutureNet();
const mainnet = NetworkConfig.MainNet();

// Custom network
const custom = NetworkConfig.CustomNet({
  networkPassphrase: "My Custom Network",
  rpcUrl: "https://rpc.custom.example.com",
  horizonUrl: "https://horizon.custom.example.com",
  friendbotUrl: "https://friendbot.custom.example.com", // optional
  allowHttp: false,
});
```

### Type narrowing

Use built-in type guards to narrow configuration types:

```ts
const config = NetworkConfig.TestNet();

if (config.isTestNet()) {
  // config is narrowed to TestNetConfig
  // friendbotUrl is guaranteed to exist
  console.log(config.friendbotUrl);
}

if (config.isMainNet()) {
  // config is narrowed to MainNetConfig
  // friendbotUrl is never available
}

if (config.isFutureNet()) {
  // config is narrowed to FutureNetConfig
}

if (config.isCustomNet()) {
  // config is narrowed to CustomNetworkConfig
}
```

### Configuration properties

All configurations provide:

- `networkPassphrase` – The network's passphrase for transaction signing
- `rpcUrl` – Soroban RPC endpoint
- `horizonUrl` – Horizon API endpoint (optional)
- `friendbotUrl` – Friendbot endpoint for test networks (not available on
  mainnet)
- `allowHttp` – Whether to allow non-HTTPS connections

`NetworkProviders` exposes preset provider helpers when an application wants a
known public endpoint selection instead of the default profile. For tests,
`initializeWithFriendbot()` can fund a Testnet or Futurenet identity and poll
until RPC observes the account. Friendbot is test infrastructure, not available
on Mainnet, and funding an identity is a separate step from generating its key.

## Discovery and canonical assets

`StellarToml.fromDomain()` fetches and validates a domain's SEP-1
`/.well-known/stellar.toml`; `fromString()` handles exact content supplied by an
application. Recognized URLs, accounts, signers, currencies, and validators are
validated by default, while unknown fields remain available in `raw`. The
normalized `sep10Config`, `sep45Config`, and `webAuthConfig` getters feed the
separate WebAuth package without making TOML discovery proof that a service or
JWT is trustworthy.

For asset interchange, the SEP-11 helpers recognize `native` and `CODE:ISSUER`,
convert supported inputs to canonical strings, and parse already-validated
strings. Use `isStellarAssetCanonicalString()` at an untrusted boundary before
parsing. Syntax and issuer checksum validation do not establish the issuer's
reputation or prove that an account has a trustline.

## Common modules

Colibri Core ships shared utilities so every layer speaks the same language:

- **Transaction configuration (`common/types`)** – `TransactionConfig` defines a
  string base fee or explicit `base`, `inclusion`, or `max` strategy alongside
  timeout, source address, signer list, and optional exact `G...`, `X...`, or
  `P...` extra-signer preconditions. For Soroban, `max` caps the complete fee
  after simulation resources are known.
- **Assertions and verifiers (`common/assert`, `common/verifiers`)** – Throw
  Colibri errors on invalid input, ensuring consistent error handling from top
  to bottom.
- **Binary helpers (`common/helpers`)** – `normalizeBinaryData` accepts
  `ArrayBuffer`, typed arrays, `DataView`, and other `ArrayBufferView` inputs
  and returns a defensive `Uint8Array` copy for stable downstream use.
- **XDR helpers (`common/helpers/xdr`)** –
  `getAddressCredentialsFromAuthEntry(...)`,
  `getAddressSignerFromAuthEntry(...)`, `getAddressTypeFromAuthEntry(...)`,
  `getAuthEntrySignatures(...)`, and `operationHasDelegatedAuthorization(...)`
  inspect legacy, address-v2, and delegated authorization entries without
  duplicating XDR-union traversal.
- **Address (`core/address`)** – Address-specific utilities such as
  muxed-account normalization.
- **Auth (`core/auth`)** – Authorization and requirement derivation helpers,
  such as classic operation threshold calculation.
- **Shared pipeline connectors (`core/pipelines/shared/connectors`)** – Reusable
  step-boundary adapters such as `buildToSimulate`, `simulateToRetval`, and
  signing-envelope connector helpers.
- **StrKey utilities (`core/strkeys`)** – Detect and validate every SEP-23 key
  (Ed25519 public/secret, muxed, contract IDs, signed payloads, liquidity pools,
  claimable balances). Two-tier checks (`is*` vs `isValid*`) let you pick
  between fast regex validation and checksum verification.

```ts
import { NetworkConfig, type TransactionConfig } from "jsr:@colibri/core";
```

By centralizing validation and typing, these modules reduce duplicated logic
across applications built on Colibri.
