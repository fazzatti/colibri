# Docker configuration and logging

[Test Tooling overview](../test-tooling.md)

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
