# @colibri/test-tooling

Test infrastructure helpers for Colibri packages.

The current public API is centered on `StellarTestLedger`, a Docker-backed
harness that starts, reuses, inspects, stops, and destroys a Stellar Quickstart
instance for integration tests.

## Installation

```bash
deno add jsr:@colibri/test-tooling
```

## Requirements

- A reachable Docker daemon such as Docker Desktop or OrbStack
- Permission to pull the `stellar/quickstart` image
- An environment where local Docker-backed integration tests are allowed to run

## Quick start

```ts
import { StellarTestLedger } from "jsr:@colibri/test-tooling";

const ledger = new StellarTestLedger();

try {
  await ledger.start();

  const network = await ledger.getNetworkConfiguration();
  console.log(network.rpcUrl);
} finally {
  await ledger.stop();
  await ledger.destroy();
}
```

## Reusing an existing container

If you already have a matching quickstart container running, you can attach to
it by name instead of starting a new one:

```ts
import { StellarTestLedger } from "jsr:@colibri/test-tooling";

const ledger = new StellarTestLedger({
  containerName: "colibri-stellar-test-ledger",
  useRunningLedger: true,
});

await ledger.start();
const network = await ledger.getNetworkConfiguration();
console.log(network.horizonUrl);
```

When `useRunningLedger` is enabled:

- `start()` fails if the named container does not exist, is not running, or uses
  a different image
- `stop()` and `destroy()` become no-ops so the harness does not shut down or
  delete a container it did not create

## Docker configuration

`StellarTestLedger` resolves Docker in this order:

1. Explicit `dockerOptions`
2. Explicit `dockerSocketPath`
3. `DOCKER_HOST`
4. Auto-detected local sockets such as `/var/run/docker.sock` and OrbStack

Example with an explicit socket:

```ts
const ledger = new StellarTestLedger({
  dockerSocketPath: "/var/run/docker.sock",
});
```

You can also provide explicit Dockerode connection options:

```ts
const ledger = new StellarTestLedger({
  dockerOptions: {
    socketPath: "/var/run/docker.sock",
  },
});
```

## Current constraints

- Only `NetworkEnv.LOCAL` is currently supported
- Only `ResourceLimits.TESTNET` is currently supported
- Supported image tags are `latest`, `v425-latest`, and `pr757-latest`
- The default container name is `colibri-stellar-test-ledger`
- `start(true)` skips the image pull step

## Options

- `containerName` controls the Docker container name used for create/reuse
- `containerImageName` and `containerImageVersion` select the quickstart image
- `useRunningLedger` attaches to an existing named container instead of creating
  one
- `dockerOptions` and `dockerSocketPath` override Docker endpoint discovery
- `emitContainerLogs` forwards container stdout/stderr into the configured
  logger
- `logger` accepts a custom logger with `trace`, `debug`, `info`, `warn`, and
  `error` methods
- `logLevel` configures the built-in fallback logger and is ignored when
  `logger` is provided

## API summary

- `new StellarTestLedger(options)` creates a quickstart ledger manager
- `ledger.start(omitPull?)` starts or reuses the Docker container and waits
  until Horizon and RPC are ready
- `ledger.getNetworkConfiguration()` returns a Colibri `NetworkConfig`
- `ledger.getContainer()` returns the Dockerode container instance
- `ledger.getContainerIpAddress()` returns the container IP reported by Docker
- `ledger.stop()` stops the tracked container without deleting it
- `ledger.destroy()` removes the tracked container and its named volumes

## Custom logging

If you want to integrate with your own logger, pass a `LoggerLike`
implementation:

```ts
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

## Errors

The package standardizes its runtime failures with quickstart-specific
`ColibriError` subclasses exported from the package root:

- `INVALID_CONFIGURATION`
- `DOCKER_CONFIGURATION_ERROR`
- `CONTAINER_ERROR`
- `IMAGE_ERROR`
- `READINESS_ERROR`

These errors include stable codes, a source of
`@colibri/test-tooling/quickstart`, and metadata with the original cause and
structured payload.
