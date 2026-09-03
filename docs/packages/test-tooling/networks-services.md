# Images, networks, and services

[Test Tooling overview](../test-tooling.md)

## Image Variants

Use `containerImageVersion` for any Quickstart tag string.

For the common moving tags, use `QuickstartImageTags`:

```typescript
import { QuickstartImageTags, StellarTestLedger } from "@colibri/test-tooling";

const ledger = new StellarTestLedger({
  containerImageVersion: QuickstartImageTags.TESTING,
});
```

For pinned builds or older tag shapes, pass the tag directly:

```typescript
const ledger = new StellarTestLedger({
  containerImageVersion: "v632-b942.1-testing",
});
```

This package intentionally does not allow-list all tag formats. Quickstart
publishes moving aliases, immutable build tags, and may introduce new tag shapes
over time.

## Network Variants

Quickstart network mode is selected with `network`:

```typescript
import {
  NetworkEnv,
  QuickstartServices,
  StellarTestLedger,
} from "@colibri/test-tooling";

const ledger = new StellarTestLedger({
  network: NetworkEnv.TESTNET,
  enabledServices: [
    QuickstartServices.HORIZON,
    QuickstartServices.RPC,
    QuickstartServices.LAB,
  ] as const,
});
```

Supported network modes:

- `NetworkEnv.LOCAL`: fastest and best for deterministic tests
- `NetworkEnv.TESTNET`: supported, but startup can take longer because
  Quickstart must sync external network state
- `NetworkEnv.FUTURENET`: supported, but startup can also take longer for the
  same reason

`limits` only applies to `NetworkEnv.LOCAL`.

## Service Variants

Use `enabledServices` to control the Quickstart `--enable` set:

```typescript
import { QuickstartServices, StellarTestLedger } from "@colibri/test-tooling";

const ledger = new StellarTestLedger({
  enabledServices: [
    QuickstartServices.RPC,
    QuickstartServices.GALEXIE,
  ] as const,
});

await ledger.start();
const details = await ledger.getNetworkDetails();

console.log(details.rpcUrl);
console.log(details.horizonUrl);
console.log(details.friendbotUrl);
console.log(details.ledgerMetaUrl);
```

The returned `getNetworkDetails()` shape follows the selected network and
service tuple. To keep the narrowest TypeScript type, pass `enabledServices` as
`const`.

Quickstart service URLs are exposed through published HTTP ports, so
`getNetworkDetails()` always includes `allowHttp: true`.

Examples:

- Local default services return `horizonUrl`, `rpcUrl`, and `friendbotUrl`
- Local `enabledServices: [QuickstartServices.RPC] as const` returns
  `horizonUrl`, `rpcUrl`, and `friendbotUrl`
- Local
  `enabledServices: [QuickstartServices.RPC, QuickstartServices.GALEXIE]
  as const`
  also returns `ledgerMetaUrl`
- Futurenet `enabledServices: [QuickstartServices.LAB] as const` returns
  `labUrl`, `transactionsExplorerUrl`, and `friendbotUrl`

Notes:

- `QuickstartServices.GALEXIE` is local-only
- `QuickstartServices.GALEXIE` must be paired with `QuickstartServices.RPC`
- core-only service selections are rejected because this harness resolves the
  Quickstart HTTP surface, not raw Stellar Core admin ports

## Stellar Lab And Ledger Meta

When Lab is enabled, `getNetworkDetails()` includes:

- `labUrl`
- `transactionsExplorerUrl`

When Galexie is enabled on local mode, `getNetworkDetails()` includes:

- `ledgerMetaUrl`
