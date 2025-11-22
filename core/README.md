# @colibri/core

Colibri Core supplies pipelines, processes, and utilities for Stellar and Soroban workflows. Currently in beta release with hardened error handling, transaction orchestration, account primitives, and typed helpers ready for integrated pipelines.

## Installation

Colibri Core is published on [JSR](https://jsr.io/@colibri/core) and ships entirely as TypeScript modules.

```sh
# Deno (JSR)
deno add jsr:@colibri/core

# Node.js / bundlers
npm install @colibri/core
```

After installation, import from the root (`jsr:@colibri/core`) or from specific paths (e.g., `jsr:@colibri/core/processes`). Published exports are declared in `core/deno.json`, ensuring compatibility with Deno, Node, and bundlers.

## Architecture overview

- **Deterministic errors** – Every recoverable failure is a named `ColibriError` subclass with a domain, code, metadata payload, and JSON representation you can rely on when monitoring or retrying. See [Error system](#error-system).
- **Pipelines** – High-level orchestrators built with `convee`, wiring processes and transformers into repeatable flows for Soroban contract invocation, read-only simulations, and classic transactions. See [Pipelines](#pipelines).
- **Processes** – Focused `ProcessEngine` units (build, simulate, authorize, assemble, sign, send) you can run individually or plug into your own pipelines. See [Processes](#processes).
- **Accounts and signers** – Strongly typed wrappers around Ed25519 identities, muxed accounts, ledger keys, and signing. See [Accounts & signers](#accounts--signers).
- **Common modules** – Shared configuration types, validators, StrKey utilities, transformers, and network profiles that keep every layer aligned. See [Common modules](#common-modules).

Use the high-level pipelines when you want an opinionated, metadata-rich flow. Drop down to processes or utilities when you need bespoke orchestration or integration with external services.

## Error system

The error layer is the backbone of Colibri Core. Every error extends the base `ColibriError`, which standardizes:

- `domain` – logical area (`pipelines`, `processes`, `tools`, `common`, etc.).
- `code` – stable identifier (`PIPE_INVOKE_002`, `PROC_SIM_004`, …) that you can log, match on, or promote to analytics.
- `source` – which module raised the error.
- `details` and `diagnostic` – human-readable stack or diagnostic object.
- `meta` – structured payload (often the input that caused the failure) so consumers can inspect context programmatically.

Each module exports its own subclasses. Example:

```ts
import { ColibriError } from "jsr:@colibri/core/error";
import * as InvokeErrors from "jsr:@colibri/core/pipelines/invoke-contract/error";

try {
  await pipe.run(input);
} catch (err) {
  if (err instanceof InvokeErrors.MISSING_ARG) {
    // handle a known configuration issue
  } else if (ColibriError.is(err)) {
    console.error(err.code, err.meta);
  } else {
    throw err;
  }
}
```

Key guarantees:

- **Uniqueness** – Codes are unique within their domain. You can use them as keys in retry logic or UX flows.
- **Type safety** – Error constructors attach typed `meta`, so narrowing via `instanceof` yields structured data without casting.
- **JSON friendliness** – `ColibriError.toJSON()` returns a stable schema, allowing you to serialize errors across process boundaries.

When wrapping unexpected exceptions, use `ColibriError.fromUnknown(error, context)` or `ColibriError.unexpected()` to preserve the original cause while emitting a Colibri-shaped error.

## Pipelines

Pipelines combine processes, transformers, and metadata storage into end-to-end transaction flows. They are instances of `Pipeline` from `convee`, giving you deterministic step execution, metadata snapshots, and the ability to inject custom connectors.

### Soroban invocation

`createInvokeContractPipeline({ networkConfig })` runs the full Soroban write path:

1. Build the transaction (`BuildTransaction`).
2. Simulate it (`SimulateTransaction`).
3. Sign Soroban authorization entries (`SignAuthEntries`).
4. Assemble the transaction (`AssembleTransaction`).
5. Determine signing requirements (`EnvelopeSigningRequirements`).
6. Apply available signers (`SignEnvelope`).
7. Submit via RPC (`SendTransaction`).

Output includes the RPC submission response, transaction hash, and the Soroban return value decoded to `xdr.ScVal`. Because every intermediate result is stored in pipeline metadata, you can inspect or replace connectors to persist additional state (e.g., audit logs or telemetry).

```ts
const pipe = createInvokeContractPipeline({ networkConfig });
const result = await pipe.run({ operations, config }); // config: TransactionConfig
```

### Read-only Soroban access

`createReadFromContractPipeline` builds a temporary transaction with an ephemeral account, runs simulation, and surfaces the `returnValue` without submitting anything. Use it for contract getters or diagnostics. The simulation response is preserved so you can review resource usage and footprints.

### Classic transaction submission

`createClassicTransactionPipeline` is the classic counterpart: it builds, computes signature requirements, signs, and submits classic operations (payments, set options, etc.), reusing the same `TransactionConfig` shape as Soroban flows so you can share configuration between the two modes.

## Processes

Processes are reusable building blocks exposed under `jsr:@colibri/core/processes`. They are perfect when you already have orchestration in place but want Colibri’s robust implementations and error surfaces.

- **BuildTransaction** – Creates transactions with optional memo, preconditions, and either RPC-derived or explicit sequence numbers. Supports plugins (`BuildTransactionPlugin`) so you can enforce extra validation or mutate transactions before they leave the step.
- **SimulateTransaction** – Wraps `Server.simulateTransaction`, producing typed success/restore responses and raising specific errors for transport failures, simulation errors, or unrecognized payloads.
- **SignAuthEntries** – Consumes simulated Soroban auth entries alongside a set of `TransactionSigner`s, returning signatures in the order Soroban expects.
- **AssembleTransaction** – Merges the base transaction, signed auth entries, Soroban data, and resource fee into a ready-to-sign transaction.
- **EnvelopeSigningRequirements** – Analyzes both envelope and Soroban requirements, yielding a checklist of signatures needed before submission.
- **SignEnvelope** – Applies available signers, allowing partial signing when you plan to collect additional approvals downstream.
- **SendTransaction** – Submits the envelope (classic or fee-bump) via RPC and normalizes RPC responses into Colibri errors when failures occur.

Each process exposes a `run(input)` method and a dedicated error namespace (e.g., `buildTransactionError`). Leverage them individually when you need customized sequencing or to integrate with other workflow engines.

## Accounts & signers

### NativeAccount

`NativeAccount` encapsulates Stellar public keys with assertive validation and helpers commonly needed in Soroban contexts:

- `NativeAccount.fromAddress(publicKey)` – validated instantiation without signer.
- `NativeAccount.fromMasterSigner(transactionSigner)` – binds a signer so pipelines can discover it automatically.
- `address()` – returns the Ed25519 public key.
- `muxedAddress(muxedId)` – produces a muxed account string with checksum validation.
- `getAccountLedgerKey()` / `getTrustlineLedgerKey(asset)` – generates typed ledger keys for state queries.

All methods throw predictable `ColibriError` subclasses when validation fails, ensuring upstream workflows can safely recover.

### LocalSigner and the TransactionSigner contract

`LocalSigner` is an in-memory Ed25519 signer that keeps the secret key within a closure (never on the instance), supports classic transaction signatures, Soroban authorization signatures, and exposes a `destroy()` method plus `[Symbol.dispose]()` to zero sensitive buffers on cleanup.

```ts
const signer = LocalSigner.fromSecret(secret);
signer.sign(transaction);
await signer.signSorobanAuthEntry(entry, validUntil, passphrase);
```

If you rely on hardware wallets, custodial services, or remote signers, implement the exported `TransactionSigner` interface. Processes and pipelines only depend on the interface, so your signers become drop-in replacements for `LocalSigner`.

## Common modules

Colibri Core ships shared utilities so every layer speaks the same language:

- **Transaction configuration (`common/types`)** – `TransactionConfig` defines fee, timeout, source address, and signer list; additional types cover base fees, time bounds, preconditions, and transaction XDR string aliases.
- **Assertions and verifiers (`common/assert`, `common/verifiers`)** – Throw Colibri errors on invalid input, ensuring consistent error handling from top to bottom.
- **Transformers (`core/transformers`)** – Bridge process output to the next step input (`buildToSimulate`, `simulateToRetval`, `assembleToEnvelopeSigningRequirements`, etc.), helping you compose custom pipelines without reimplementing glue logic.
- **StrKey utilities (`core/strkeys`)** – Detect and validate every SEP-23 key (Ed25519 public/secret, muxed, contract IDs, signed payloads, liquidity pools, claimable balances). Two-tier checks (`is*` vs `isValid*`) let you pick between fast regex validation and checksum verification.
- **Network profiles (`core/network`)** – Typed factory functions for `TestNet`, `FutureNet`, `MainNet`, and `CustomNet`. These provide passphrases, RPC URLs, Friendbot endpoints, and Horizon URLs so all orchestrators operate on consistent environment data.

```ts
import { TestNet } from "jsr:@colibri/core/network";
import type { TransactionConfig } from "jsr:@colibri/core/common/types";
```

By centralizing validation and typing, these modules reduce duplicated logic across applications built on Colibri.
