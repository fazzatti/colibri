# Installation

Colibri packages are published to [JSR](https://jsr.io/) (JavaScript Registry)
and designed for the Deno runtime.

## Prerequisites

- [Deno](https://deno.land/) v2.0 or later
- A reachable Docker daemon such as Docker Desktop or OrbStack if you plan to
  use `@colibri/test-tooling`

## Installing Packages

### Using Deno

Add packages directly to your project using `deno add`:

```bash
# Core package (required)
deno add jsr:@colibri/core

# SEP-10 authentication (optional)
deno add jsr:@colibri/sep10

# RPC Streamer (optional)
deno add jsr:@colibri/rpc-streamer

# Test Tooling (optional, for Docker-backed integration tests)
deno add jsr:@colibri/test-tooling

# Fee Bump Plugin (optional)
deno add jsr:@colibri/plugin-fee-bump
```

This will add the packages to your `deno.json` imports map:

```json
{
  "imports": {
    "@colibri/core": "jsr:@colibri/core@^0.17.3",
    "@colibri/sep10": "jsr:@colibri/sep10@^0.5.2",
    "@colibri/rpc-streamer": "jsr:@colibri/rpc-streamer@^0.2.3",
    "@colibri/test-tooling": "jsr:@colibri/test-tooling@^0.2.0",
    "@colibri/plugin-fee-bump": "jsr:@colibri/plugin-fee-bump@^0.9.2"
  }
}
```

### Direct Import

You can also import directly from JSR URLs:

```typescript
import { LocalSigner, NetworkConfig } from "jsr:@colibri/core@^0.17.3";
import { RPCStreamer } from "jsr:@colibri/rpc-streamer@^0.2.3";
import { StellarTestLedger } from "jsr:@colibri/test-tooling@^0.2.0";
```

## Package Overview

### [@colibri/core](../core/overview.md)

The foundation package containing all core primitives for Stellar and Soroban
development: account management, contract client, network configuration,
transaction pipelines and processes, event parsing, signers, and typed error
handling.

### [@colibri/rpc-streamer](../packages/rpc-streamer.md)

Generic RPC streaming framework for real-time and historical data ingestion
(events, ledgers, or custom data types) with support for live streaming, archive
fetching, and automatic mode switching.

### [@colibri/sep10](../packages/sep10.md)

SEP-10 Web Authentication helpers for fetching challenge transactions, signing
them, and exchanging them for JWTs.

### [@colibri/test-tooling](../packages/test-tooling.md)

Docker-backed integration test helpers centered on `StellarTestLedger`, a
harness for managing local Stellar Quickstart ledgers in automated tests.

### [Plugins](../packages/plugins/)

Use case-specific plugins extend pipeline step behavior. Each plugin is
published as its own package:

| Plugin                                      | Package                    | Description                                       |
| ------------------------------------------- | -------------------------- | ------------------------------------------------- |
| [Fee Bump](../packages/plugins/fee-bump.md) | `@colibri/plugin-fee-bump` | Wrap transactions for third-party fee sponsorship |

## Stellar SDK Dependency

Colibri uses `@stellar/stellar-sdk` internally. You may need to import it
directly for certain operations:

```typescript
import { Keypair, xdr } from "npm:@stellar/stellar-sdk";
```

The SDK is re-exported through Colibri where needed, but for advanced XDR
manipulation, you may want to add it explicitly:

```bash
deno add npm:@stellar/stellar-sdk
```

## Next Steps

- [Quick Start](quick-start.md) — Build your first transaction
- [Architecture Overview](architecture.md) — Understand the design principles
