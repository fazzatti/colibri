# Contract

`Contract` is Colibri's high-level Soroban client. It owns a
[read pipeline](pipelines/read-from-contract.md) and an
[invoke pipeline](pipelines/invoke-contract.md), and composes deployment, spec
loading, argument encoding, authorization, and submission through Core.

Start with a client bound to a deployed contract, or configure an executable to
deploy a new instance. Function reads use simulation; writes use the transaction
pipeline. [`getLedgerEntry()`](contract/invocation.md#getledgerentry) reads
stored contract data directly through RPC.

Write calls accept [TransactionConfig](transaction-config.md), including
[signers](signer/README.md),
[fee strategies](transaction-config.md#fee-strategies), and optional
[resource controls](resources.md).

## Guides

- [Configure a contract client](contract/configuration.md)
- [Read and invoke](contract/invocation.md)
- [Validate Soroban values](contract/values.md)
- [Load spec-aware event definitions](contract/events.md)
- [Deploy and load a specification](contract/deployment.md)
- [Inspect metadata, SEP claims, and contract interfaces](contract/metadata-and-interfaces.md)
- [Contract errors and pipeline plugins](contract/plugins.md)

See the [API and error reference](../reference/README.md) for exact exported
symbols and complete error contexts.
