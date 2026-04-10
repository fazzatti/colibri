# Installation

Colibri packages are published on [JSR](https://jsr.io/) and are designed for
Deno-first TypeScript projects.

## Prerequisites

- [Deno](https://deno.land/) `v2.0` or later
- A reachable Docker daemon such as Docker Desktop or OrbStack if you plan to
  use `@colibri/test-tooling`

## Installing Packages

### Using `deno add`

```bash
# Core package
deno add jsr:@colibri/core

# Optional packages
deno add jsr:@colibri/sep10
deno add jsr:@colibri/rpc-streamer
deno add jsr:@colibri/test-tooling
deno add jsr:@colibri/plugin-fee-bump
deno add jsr:@colibri/plugin-channel-accounts
```

This will add imports similar to:

```json
{
  "imports": {
    "@colibri/core": "jsr:@colibri/core@^0.18.0",
    "@colibri/sep10": "jsr:@colibri/sep10@^0.5.3",
    "@colibri/rpc-streamer": "jsr:@colibri/rpc-streamer@^0.2.4",
    "@colibri/test-tooling": "jsr:@colibri/test-tooling@^0.3.0",
    "@colibri/plugin-fee-bump": "jsr:@colibri/plugin-fee-bump@^0.9.3",
    "@colibri/plugin-channel-accounts": "jsr:@colibri/plugin-channel-accounts@^0.1.0"
  }
}
```

### Direct JSR Imports

```ts
import { Contract, NetworkConfig } from "jsr:@colibri/core";
import { RPCStreamer } from "jsr:@colibri/rpc-streamer";
import { StellarTestLedger } from "jsr:@colibri/test-tooling";
```

## Package Overview

### [@colibri/core](../core/overview.md)

The main toolkit package. It includes account helpers, contract clients,
transaction config types, typed errors, process functions, step factories, and
the built-in pipeline factories such as `createInvokeContractPipeline(...)`.

### [@colibri/rpc-streamer](../packages/rpc-streamer.md)

Streaming helpers for live and historical Stellar RPC ingestion.

### [@colibri/sep10](../packages/sep10.md)

SEP-10 Web Authentication helpers for challenge fetching, signing, and token
exchange.

### [@colibri/test-tooling](../packages/test-tooling.md)

Docker-backed integration helpers centered on `StellarTestLedger`.

### [Plugins](../packages/plugins/README.md)

Plugins extend pipeline step behavior for specific use cases:

| Plugin                                                        | Package                              | Description                                       |
| ------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------- |
| [Fee Bump](../packages/plugins/fee-bump.md)                   | `@colibri/plugin-fee-bump`           | Wrap outgoing transactions in a fee-bump envelope |
| [Channel Accounts](../packages/plugins/channel-accounts.md)   | `@colibri/plugin-channel-accounts`   | Reuse sponsored channel accounts across write runs |

## Stellar SDK Dependency

Colibri stays close to `@stellar/stellar-sdk`, and many advanced flows still
use SDK values directly:

```ts
import { Operation, xdr } from "npm:@stellar/stellar-sdk";
```

If you need low-level XDR manipulation or raw operation construction, add the
SDK explicitly:

```bash
deno add npm:@stellar/stellar-sdk
```

## Next Steps

- [Quick Start](quick-start.md) — Build your first Soroban interaction
- [Architecture Overview](architecture.md) — Understand the Colibri layers
