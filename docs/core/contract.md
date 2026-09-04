# Contract

`Contract` is Colibri's high-level Soroban client. It owns a read pipeline and
an invoke pipeline, and composes deployment, spec loading, argument encoding,
authorization, and submission through Core.

Start with a client bound to a deployed contract, or configure an executable to
deploy a new instance. State reads use simulation; writes use the transaction
pipeline.

## Guides

- [Configure a contract client](contract/configuration.md)
- [Read and invoke](contract/invocation.md)
- [Deploy and load a specification](contract/deployment.md)
- [Inspect metadata, SEP claims, and contract interfaces](contract/metadata-and-interfaces.md)
- [Contract errors and pipeline plugins](contract/plugins.md)

See the [API and error reference](../reference/README.md) for exact exported
symbols and complete error contexts.
