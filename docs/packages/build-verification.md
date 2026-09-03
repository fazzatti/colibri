# Contract Build Verification

`@colibri/build-verification` rebuilds source in a digest-pinned image and
compares the result with target Wasm bytes. A verified build demonstrates
reproducibility, not contract safety or an audit.

```sh
deno add jsr:@colibri/build-verification jsr:@colibri/core
```

Use strict SEP-58 mode for metadata committed by the target, or explicitly
choose an out-of-band recipe. The default runner requires a reachable Docker
daemon.

## Guides

- [Targets and verification results](build-verification/targets.md)
- [Sources and build recipes](build-verification/sources.md)
- [Pipelines, providers, and runners](build-verification/architecture.md)
- [Policies and isolation](build-verification/policies.md)
- [Command-line verification](build-verification/cli.md)
- [Evidence and logs](build-verification/reporting.md)

See the [API and error reference](../reference/README.md) for exact exported
symbols and complete error contexts.
