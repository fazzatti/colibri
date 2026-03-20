# @colibri/test-tooling

Test infrastructure helpers for Colibri packages.

The current public API is centered on `StellarTestLedger`, a small harness that starts, reuses, inspects, and destroys a Docker-backed Stellar Quickstart instance for integration tests.

## Installation

```bash
deno add jsr:@colibri/test-tooling
```

## Quick start

```ts
import { StellarTestLedger } from "jsr:@colibri/test-tooling";

const ledger = new StellarTestLedger({
  emitContainerLogs: true,
  logLevel: "debug",
});

await ledger.start();

const network = await ledger.getNetworkConfiguration();
console.log(network.rpcUrl);

await ledger.stop();
await ledger.destroy();
```

## Reusing an existing container

If you already have a matching quickstart container running, you can attach to it by name instead of starting a new one:

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

## API summary

- `new StellarTestLedger(options)` creates a quickstart ledger manager
- `ledger.start(omitPull?)` starts or reuses the Docker container
- `ledger.getNetworkConfiguration()` returns a Colibri `NetworkConfig`
- `ledger.getContainer()` returns the Dockerode container instance
- `ledger.getContainerIpAddress()` returns the container IP reported by Docker
- `ledger.stop()` stops the tracked container without deleting it
- `ledger.destroy()` removes the tracked container and its named volumes

## Errors

The package standardizes its runtime failures with quickstart-specific `ColibriError` subclasses exported from the package root:

- `INVALID_CONFIGURATION`
- `DOCKER_CONFIGURATION_ERROR`
- `CONTAINER_ERROR`
- `IMAGE_ERROR`
- `READINESS_ERROR`

These errors include stable codes, a source of `@colibri/test-tooling/quickstart`, and metadata with the original cause and structured payload.
