# Test Tooling

The `@colibri/test-tooling` package provides Docker-backed test infrastructure
for Colibri packages.

Its current public API is centered on `StellarTestLedger`, a Docker-backed
harness that starts, reuses, inspects, stops, and destroys a Stellar Quickstart
instance for integration tests.

## Installation

```bash
deno add jsr:@colibri/test-tooling
```

## Requirements

- A reachable Docker daemon such as Docker Desktop or OrbStack
- Permission to pull the `stellar/quickstart` image
- An environment where Docker-backed integration tests are allowed to run

## Quick Start

```typescript
import { StellarTestLedger } from "@colibri/test-tooling";

const ledger = new StellarTestLedger();

try {
  await ledger.start();

  const details = await ledger.getNetworkDetails();
  console.log(details.rpcUrl);
} finally {
  await ledger.stop();
  await ledger.destroy();
}
```

By default, `StellarTestLedger` starts a local standalone Quickstart container
with:

- `containerImageVersion: "latest"`
- `network: NetworkEnv.LOCAL`
- `limits: ResourceLimits.TESTNET`
- `enabledServices: ["core", "horizon", "rpc"]`
- ephemeral storage

`start()` waits only for the services implied by the selected network and
enabled services. For the default local setup, that means Horizon, Soroban RPC,
and Friendbot are ready before `start()` resolves.

## Image Variants

Use `containerImageVersion` for any Quickstart tag string.

For the common moving tags, use `QuickstartImageTags`:

```typescript
import {
  QuickstartImageTags,
  StellarTestLedger,
} from "@colibri/test-tooling";

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
publishes moving aliases, immutable build tags, and may introduce new tag
shapes over time.

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
import {
  QuickstartServices,
  StellarTestLedger,
} from "@colibri/test-tooling";

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

## Persistent Mode

Use `storage` to switch from the default ephemeral container to a mounted
persistent volume:

```typescript
import {
  QuickstartStorageModes,
  StellarTestLedger,
} from "@colibri/test-tooling";

const ledger = new StellarTestLedger({
  storage: {
    mode: QuickstartStorageModes.PERSISTENT,
    hostPath: "/absolute/path/to/stellar-data",
  },
});
```

Persistent mode mounts `hostPath` into `/opt/stellar`.

Use it carefully:

- Quickstart's on-disk layout can change between image releases
- first-time initialization of an empty persistent directory can be more
  operationally sensitive than ephemeral mode
- pinned image tags are safer than moving tags when reusing persistent data

## Reusing An Existing Container

If you already have a matching quickstart container running, you can attach to
it by name instead of starting a new one:

```typescript
import { StellarTestLedger } from "@colibri/test-tooling";

const ledger = new StellarTestLedger({
  containerName: "colibri-stellar-test-ledger",
  useRunningLedger: true,
});

await ledger.start();
const details = await ledger.getNetworkDetails();
console.log(details.horizonUrl);
```

When `useRunningLedger` is enabled:

- `start()` fails if the named container does not exist, is not running, or
  uses a different image/configuration
- `stop()` and `destroy()` become no-ops so the harness does not shut down or
  delete a container it did not create

## Docker Configuration

`StellarTestLedger` resolves Docker in this order:

1. Explicit `dockerOptions`
2. Explicit `dockerSocketPath`
3. `DOCKER_HOST`
4. Auto-detected local sockets such as `/var/run/docker.sock` and OrbStack

Example with an explicit socket:

```typescript
const ledger = new StellarTestLedger({
  dockerSocketPath: "/var/run/docker.sock",
});
```

You can also provide explicit Dockerode connection options:

```typescript
const ledger = new StellarTestLedger({
  dockerOptions: {
    socketPath: "/var/run/docker.sock",
  },
});
```

## Options

- `containerName` controls the Docker container name used for create/reuse
- `containerImageName` and `containerImageVersion` select the Quickstart image
- `network` selects local, testnet, or futurenet mode
- `limits` selects the local standalone resource profile
- `enabledServices` controls the Quickstart `--enable` list
- `storage` switches between ephemeral and persistent mode
- `useRunningLedger` attaches to an existing named container instead of
  creating one
- `dockerOptions` and `dockerSocketPath` override Docker endpoint discovery
- `emitContainerLogs` forwards container stdout/stderr into the configured
  logger
- `logger` accepts a custom logger with `trace`, `debug`, `info`, `warn`, and
  `error` methods
- `logLevel` configures the built-in fallback logger and is ignored when
  `logger` is provided

## API Summary

- `new StellarTestLedger(options)` creates a quickstart ledger manager
- `ledger.start(omitPull?)` starts or reuses the Docker container and waits
  until the requested services are ready
- `ledger.getNetworkDetails()` returns the plain service payload for the
  running ledger
- `ledger.getNetworkConfiguration()` is an alias of `getNetworkDetails()`
- `ledger.getContainer()` returns the Dockerode container instance
- `ledger.getContainerIpAddress()` returns the container IP reported by Docker
- `ledger.stop()` stops the tracked container without deleting it
- `ledger.destroy()` removes the tracked container and its named volumes

## Custom Logging

If you want to integrate with your own logger, pass a `LoggerLike`
implementation:

```typescript
const logger = {
  trace: (...msg: unknown[]) => console.debug("[ledger:trace]", ...msg),
  debug: (...msg: unknown[]) => console.debug("[ledger:debug]", ...msg),
  info: (...msg: unknown[]) => console.info("[ledger:info]", ...msg),
  warn: (...msg: unknown[]) => console.warn("[ledger:warn]", ...msg),
  error: (...msg: unknown[]) => console.error("[ledger:error]", ...msg),
};

const ledger = new StellarTestLedger({
  logger,
  emitContainerLogs: true,
});
```

## Error Handling

The package standardizes its runtime failures with quickstart-specific error
subclasses exported from the package root:

- `INVALID_CONFIGURATION`
- `DOCKER_CONFIGURATION_ERROR`
- `CONTAINER_ERROR`
- `IMAGE_ERROR`
- `READINESS_ERROR`

These errors include stable codes, a source of
`@colibri/test-tooling/quickstart`, and metadata with the original cause and
structured payload.
