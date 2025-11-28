# Installation

Colibri packages are published to [JSR](https://jsr.io/) (JavaScript Registry) and designed for the Deno runtime.

## Prerequisites

* [Deno](https://deno.land/) v2.0 or later

## Installing Packages

### Using Deno

Add packages directly to your project using `deno add`:

```bash
# Core package (required)
deno add jsr:@colibri/core

# Event Streamer (optional)
deno add jsr:@colibri/event-streamer

# Fee Bump Plugin (optional)
deno add jsr:@colibri/plugin-fee-bump
```

This will add the packages to your `deno.json` imports map:

```json
{
  "imports": {
    "@colibri/core": "jsr:@colibri/core@^0.1.0",
    "@colibri/event-streamer": "jsr:@colibri/event-streamer@^0.1.0",
    "@colibri/plugin-fee-bump": "jsr:@colibri/plugin-fee-bump@^0.1.0"
  }
}
```

### Direct Import

You can also import directly from JSR URLs:

```typescript
import { NetworkConfig, LocalSigner } from "jsr:@colibri/core@^0.1.0";
import { EventStreamer } from "jsr:@colibri/event-streamer@^0.1.0";
```

## Package Overview

### [@colibri/core](../core/overview.md)

The foundation package containing all core primitives for Stellar and Soroban development: account management, contract client, network configuration, transaction pipelines and processes, event parsing, signers, and typed error handling.

### [@colibri/event-streamer](../packages/event-streamer.md)

Real-time and historical event ingestion with support for live streaming, archive fetching, and automatic mode switching.

### [Plugins](../packages/plugins/)

Use case-specific plugins extend pipeline and process behavior. Each plugin is published as its own package:

| Plugin                                         | Package                    | Description                                       |
| ---------------------------------------------- | -------------------------- | ------------------------------------------------- |
| [Fee Bump](/broken/pages/K772Z56ARvj70OPYUbLz) | `@colibri/plugin-fee-bump` | Wrap transactions for third-party fee sponsorship |

## Stellar SDK Dependency

Colibri uses `@stellar/stellar-sdk` internally. You may need to import it directly for certain operations:

```typescript
import { Keypair, xdr } from "@stellar/stellar-sdk";
```

The SDK is re-exported through Colibri where needed, but for advanced XDR manipulation, you may want to add it explicitly:

```bash
deno add npm:@stellar/stellar-sdk
```

## Next Steps

* [Quick Start](quick-start.md) — Build your first transaction
* [Architecture Overview](architecture.md) — Understand the design principles
