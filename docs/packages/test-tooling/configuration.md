# Docker configuration and logging

[Test Tooling overview](../test-tooling.md)

## Before running the examples

Each TypeScript block below is a complete, independent script. Ensure Docker is
running and install the package in your Deno project:

```sh
deno add jsr:@colibri/test-tooling
```

Run the examples separately using the commands beside them. The `-A` permission
flag allows host-side Docker discovery, image/container operations, and HTTP
readiness checks. Each script starts a disposable local ledger, prints its RPC
URL after startup, and stops and removes its container in `finally`.

## Docker Configuration

`StellarTestLedger` resolves Docker in this order:

1. Explicit `dockerOptions`
2. Explicit `dockerSocketPath`
3. `DOCKER_HOST`
4. Auto-detected local sockets such as `/var/run/docker.sock` and OrbStack

For an explicit socket, save the following as `ledger-socket.ts` and run
`deno run -A ledger-socket.ts`. Replace `/var/run/docker.sock` if your Docker
socket is elsewhere; the path must point to a running Docker daemon.

<!-- deno-check -->

```typescript
import { StellarTestLedger } from "@colibri/test-tooling";

const ledger = new StellarTestLedger({
  dockerSocketPath: "/var/run/docker.sock",
});

try {
  await ledger.start();
  const details = await ledger.getNetworkDetails();
  console.log(details.rpcUrl);
} finally {
  await ledger.stop();
  await ledger.destroy();
}
```

Alternatively, provide Dockerode connection options through `dockerOptions`.
Save this script as `ledger-docker-options.ts` and run
`deno run -A ledger-docker-options.ts`, adjusting the socket path for your host.

<!-- deno-check -->

```typescript
import { StellarTestLedger } from "@colibri/test-tooling";

const ledger = new StellarTestLedger({
  dockerOptions: {
    socketPath: "/var/run/docker.sock",
  },
});

try {
  await ledger.start();
  const details = await ledger.getNetworkDetails();
  console.log(details.rpcUrl);
} finally {
  await ledger.stop();
  await ledger.destroy();
}
```

## Options

- `containerName` controls the Docker container name used for create/reuse
- `containerImageName` and `containerImageVersion` select the Quickstart image
- `network` selects local, testnet, or futurenet mode
- `limits` selects the local standalone resource profile
- `enabledServices` controls the Quickstart `--enable` list
- `storage` switches between ephemeral and persistent mode
- `useRunningLedger` attaches to an existing named container instead of creating
  one
- `dockerOptions` and `dockerSocketPath` override Docker endpoint discovery
- `emitContainerLogs` forwards container stdout/stderr into the configured
  logger
- `logger` accepts a custom logger with `trace`, `debug`, `info`, `warn`, and
  `error` methods
- `logLevel` configures the built-in fallback logger and is ignored when
  `logger` is provided

## Custom Logging

To integrate with your own logger, pass an object implementing `LoggerLike`.
This example uses console methods and automatic Docker discovery. Save it as
`ledger-logging.ts` and run `deno run -A ledger-logging.ts`; you will see
lifecycle messages and forwarded container output as well as the ready RPC URL.

<!-- deno-check -->

```typescript
import { StellarTestLedger } from "@colibri/test-tooling";

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

try {
  await ledger.start();
  const details = await ledger.getNetworkDetails();
  logger.info("Local ledger RPC:", details.rpcUrl);
} finally {
  await ledger.stop();
  await ledger.destroy();
}
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
