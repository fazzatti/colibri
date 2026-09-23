# Test Tooling

`@colibri/test-tooling` provides `StellarTestLedger`, a Docker-backed Stellar
Quickstart harness. It [starts](test-tooling/quick-start.md),
[reuses and stops](test-tooling/lifecycle.md) ledger containers for local
integration workflows.

```sh
deno add jsr:@colibri/test-tooling
```

You need a reachable Docker daemon and permission to pull the configured
Quickstart image. This is host-side tooling, not a browser library.

## Guides

- [Start a local ledger](test-tooling/quick-start.md)
- [Images, networks, and services](test-tooling/networks-services.md)
- [Persistence and container reuse](test-tooling/lifecycle.md)
- [Docker configuration and logging](test-tooling/configuration.md)

See the [API and error reference](../reference/README.md) for exact exported
symbols and complete error contexts.

## Execution evidence

[Record test evidence](test-tooling/recorder.md) covers contract and pipeline
observation, per-file journals, JSON/HTML artifacts and transaction profiling.
Use `/recorder/deno` with Deno BDD or `/recorder/node` with Node's native test
runner. Both share the same recorder settings and artifact/report formats;
neither requires Docker.
