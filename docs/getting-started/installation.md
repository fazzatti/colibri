# Installation

Colibri packages are published on [JSR](https://jsr.io/) and are designed for
Deno-first TypeScript projects.

## Prerequisites

- [Deno](https://deno.land/) 2; this repository validates with `v2.7.11`
- Node.js `v22.12` or later when consuming Colibri through npm or a Node-based
  bundler
- A reachable Docker daemon such as Docker Desktop or OrbStack if you plan to
  use `@colibri/test-tooling` or the built-in `@colibri/build-verification`
  runner

## Installing Packages

### Using `deno add`

```bash
# Core package
deno add jsr:@colibri/core

# Optional packages
deno add jsr:@colibri/webauth
deno add jsr:@colibri/build-verification
deno add jsr:@colibri/identicon
deno add jsr:@colibri/rpc-streamer
deno add jsr:@colibri/test-tooling
deno add jsr:@colibri/plugin-fee-bump
deno add jsr:@colibri/plugin-channel-accounts
```

This will add imports similar to:

```json
{
  "imports": {
    "@colibri/core": "jsr:@colibri/core@^0.27.0",
    "@colibri/webauth": "jsr:@colibri/webauth@^0.2.0",
    "@colibri/build-verification": "jsr:@colibri/build-verification@^0.4.0",
    "@colibri/identicon": "jsr:@colibri/identicon@^0.1.0",
    "@colibri/rpc-streamer": "jsr:@colibri/rpc-streamer@^0.2.15",
    "@colibri/test-tooling": "jsr:@colibri/test-tooling@^0.3.1",
    "@colibri/plugin-fee-bump": "jsr:@colibri/plugin-fee-bump@^0.10.2",
    "@colibri/plugin-channel-accounts": "jsr:@colibri/plugin-channel-accounts@^0.2.11"
  }
}
```

### Direct JSR Imports

```ts
import { Contract, NetworkConfig } from "jsr:@colibri/core";
import { RPCStreamer } from "jsr:@colibri/rpc-streamer";
import { StellarTestLedger } from "jsr:@colibri/test-tooling";
import { WebAuthClient } from "jsr:@colibri/webauth";
import { ContractBuildVerifier } from "jsr:@colibri/build-verification";
import { Identicon } from "jsr:@colibri/identicon";
```

## Runtime boundaries

The examples use Deno and package aliases created by `deno add`. Networked
examples need `--allow-net`; reading secrets from environment variables also
needs `--allow-env`. Local file examples need file permissions. Docker-backed
tools need host access and are not browser APIs.

For Node or a bundler, install JSR packages through the JSR adapter, for example
`npx jsr add @colibri/core`, and install `@stellar/stellar-sdk` with your
package manager if you import it directly. Replace the examples'
`npm:@stellar/stellar-sdk` specifier with `@stellar/stellar-sdk` in that
environment. Do not copy Deno's `Deno.env`, filesystem, or Docker examples into
a browser.

Use the SDK major supported by your Colibri release (17 for this release), not
an independently upgraded major. Colibri's SDK-facing objects should come from
compatible SDK versions throughout your application.

## Package Overview

### [@colibri/core](../core/overview.md)

The main toolkit package. It includes account helpers, contract clients,
transaction config types, typed errors, process functions, step factories, and
the built-in pipeline factories such as `createInvokeContractPipeline(...)`.

### [@colibri/rpc-streamer](../packages/rpc-streamer.md)

Streaming helpers for live and historical Stellar RPC ingestion.

### [@colibri/webauth](../packages/webauth.md)

Unified SEP-10 and SEP-45 Web Authentication with automatic account routing,
explicit protocol clients, and contract authorization hooks.

### [@colibri/build-verification](../packages/build-verification.md)

Strict SEP-58 and explicitly caller-directed out-of-band contract build
verification with digest-pinned images, safe source extraction, bounded Docker
execution, and typed evidence.

### [@colibri/identicon](../packages/identicon.md)

Local SEP-33 identicons for Stellar G-addresses, with reference-compatible
patterns, SVG and PNG rendering, data URLs, and immutable matrix/color data.

### [@colibri/test-tooling](../packages/test-tooling.md)

Docker-backed integration helpers centered on `StellarTestLedger`.

### [Plugins](../packages/plugins/README.md)

Plugins extend pipeline step behavior for specific use cases:

| Plugin                                                      | Package                            | Description                                        |
| ----------------------------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| [Fee Bump](../packages/plugins/fee-bump.md)                 | `@colibri/plugin-fee-bump`         | Wrap outgoing transactions in a fee-bump envelope  |
| [Channel Accounts](../packages/plugins/channel-accounts.md) | `@colibri/plugin-channel-accounts` | Reuse sponsored channel accounts across write runs |

## Stellar SDK Dependency

Colibri stays close to `@stellar/stellar-sdk`, and many advanced flows still use
SDK values directly. The current Colibri releases target Stellar SDK 17 and use
its canonical class-based XDR API. Binary SDK values are `Uint8Array` instances;
Node `Buffer` is not required for normal Colibri usage.

```ts
import { Operation, xdr } from "npm:@stellar/stellar-sdk";
```

If you need low-level XDR manipulation or raw operation construction, add the
SDK explicitly:

```bash
deno add npm:@stellar/stellar-sdk@^17
```

## Next Steps

- [Quick Start](quick-start.md) — Submit a complete Testnet payment
- [Read and invoke a contract](contract-call.md) — Load a deployed contract's
  spec
- [Architecture Overview](architecture.md) — Understand the Colibri layers
