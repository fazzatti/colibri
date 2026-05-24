# @colibri/core

Colibri Core supplies pipelines, processes, and utilities for Stellar and
Soroban workflows. Currently in beta release with hardened error handling,
transaction orchestration, account primitives, and typed helpers ready for
integrated pipelines.

<a href="https://jsr.io/@colibri/core">
  <img src="https://jsr.io/badges/@colibri/core" alt="JSR @colibri/core" />
</a>
<a href="https://jsr.io/@colibri/core">
  <img src="https://jsr.io/badges/@colibri/core/total-downloads" alt="JSR total downloads for @colibri/core" />
</a>

[📚 Documentation](https://fifo-docs.gitbook.io/colibri) |
[💡 Examples](https://github.com/fazzatti/colibri-examples)

## Installation

Colibri Core is published on [JSR](https://jsr.io/@colibri/core) and ships
entirely as TypeScript modules.

```sh
# Deno (JSR)
deno add jsr:@colibri/core

# Node.js / bundlers
npm install @colibri/core
```

After installation, import from the package root (`jsr:@colibri/core`).
Published exports are declared in `core/deno.json`, ensuring compatibility with
Deno, Node, and bundlers.

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
  await pipe.run(input);
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
2. Simulate it (`SimulateTransaction`).
3. Sign Soroban authorization entries (`SignAuthEntries`).
4. Assemble the transaction (`AssembleTransaction`).
5. Determine signing requirements (`EnvelopeSigningRequirements`).
6. Apply available signers (`SignEnvelope`).
7. Submit via RPC (`SendTransaction`).

Output includes the RPC submission response, transaction hash, and the Soroban
return value decoded to `xdr.ScVal`. Connectors use `convee` run context to
access prior step outputs where needed, instead of the old metadata helper
pattern.

```ts
const pipe = createInvokeContractPipeline({ networkConfig });
const result = await pipe.run({ operations, config }); // config: TransactionConfig
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
Soroban flows so you can share configuration between the two modes.

## Processes

Processes are reusable building blocks exported from `jsr:@colibri/core`. They
are plain functions, which makes them easy to test directly and easy to reuse
outside Colibri's built-in pipelines.

- **BuildTransaction** – Creates transactions with optional memo, preconditions,
  and either RPC-derived or explicit sequence numbers.
- **SimulateTransaction** – Wraps `Server.simulateTransaction`, producing typed
  success/restore responses and raising specific errors for transport failures,
  generic simulation failures, parsed contract errors, or unrecognized payloads.
- **SignAuthEntries** – Consumes simulated Soroban auth entries alongside a set
  of `TransactionSigner`s, returning signatures in the order Soroban expects.
- **AssembleTransaction** – Merges the base transaction, signed auth entries,
  Soroban data, and resource fee into a ready-to-sign transaction.
- **EnvelopeSigningRequirements** – Analyzes both envelope and Soroban
  requirements, yielding a checklist of signatures needed before submission.
- **SignEnvelope** – Applies available signers, allowing partial signing when
  you plan to collect additional approvals downstream.
- **SendTransaction** – Submits the envelope (classic or fee-bump) via RPC and
  normalizes RPC responses into Colibri errors when failures occur.

Each process is exported as a function plus an error namespace. Example:

```ts
import { BTX_ERRORS, buildTransaction } from "jsr:@colibri/core";

const transaction = await buildTransaction(input);
```

When you need orchestration ids or plugin targets, use the matching step factory
from `jsr:@colibri/core`.

## Core plugins

Core plugins are shipped with `@colibri/core` and attach to built-in pipeline
steps with `pipeline.use(...)`.

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

const pipe = createInvokeContractPipeline({ networkConfig });

pipe.use(
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

## Accounts & signers

### NativeAccount

`NativeAccount` encapsulates Stellar public keys with assertive validation and
helpers commonly needed in Soroban contexts:

- `NativeAccount.fromAddress(publicKey)` – validated instantiation without
  signer.
- `NativeAccount.fromMasterSigner(transactionSigner)` – binds a signer so
  pipelines can discover it automatically.
- `address()` – returns the Ed25519 public key.
- `muxedAddress(muxedId)` – produces a muxed account string with checksum
  validation.
- `getAccountLedgerKey()` / `getTrustlineLedgerKey(asset)` – generates typed
  ledger keys for state queries.

All methods throw predictable `ColibriError` subclasses when validation fails,
ensuring upstream workflows can safely recover.

### LocalSigner and the TransactionSigner contract

`LocalSigner` is an in-memory Ed25519 signer that keeps the secret key within a
closure (never on the instance), supports classic transaction signatures,
Soroban authorization signatures, and exposes a `destroy()` method plus
`[Symbol.dispose]()` to zero sensitive buffers on cleanup.

```ts
const signer = LocalSigner.fromSecret(secret);
signer.sign(transaction);
await signer.signSorobanAuthEntry(entry, validUntil, passphrase);
```

If you rely on hardware wallets, custodial services, or remote signers,
implement the exported `TransactionSigner` interface. Processes and pipelines
only depend on the interface, so your signers become drop-in replacements for
`LocalSigner`.

## High-level contract clients

### Contract

`Contract` is the flexible Soroban client when you want to work directly with a
known contract id, wasm, or deployed contract metadata. It exposes its
`invokePipe` and `readPipe` publicly, which makes it the right seam for advanced
pipeline plugin composition.

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
import { xdr } from "stellar-sdk";

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

**Topic wildcards:** `"*"` matches one segment, `"**"` matches zero or more.

### Ledger metadata utilities

Helper functions for working with ledger close metadata:

```ts
import { isLedgerCloseMetaV1, isLedgerCloseMetaV2 } from "jsr:@colibri/core";

// Type guards for metadata versions
if (isLedgerCloseMetaV2(meta)) {
  // access V2-specific fields like txProcessing
}
```

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

## Common modules

Colibri Core ships shared utilities so every layer speaks the same language:

- **Transaction configuration (`common/types`)** – `TransactionConfig` defines
  fee, timeout, source address, and signer list; additional types cover base
  fees, time bounds, preconditions, and transaction XDR string aliases.
- **Assertions and verifiers (`common/assert`, `common/verifiers`)** – Throw
  Colibri errors on invalid input, ensuring consistent error handling from top
  to bottom.
- **Binary helpers (`common/helpers`)** – `normalizeBinaryData` accepts
  `ArrayBuffer`, typed arrays, `DataView`, and other `ArrayBufferView` inputs
  and returns a defensive `Uint8Array` copy for stable downstream use.
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
