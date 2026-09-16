# Failures and ABI upgrades

## Failures and ABI changes

The embedded ABI is a snapshot. Regenerate after a contract upgrade. Loading a
different spec into the typed class invalidates its type guarantees. Provenance
contains code hashes and separate RPC ledger observations, not an atomic network
snapshot or endpoint credentials.

Inspect `error.code` on a caught `BindingError` for stable
CLI/source/rendering/output failures and its cause for the Core or filesystem
error. The [error catalog](../../reference/errors/contract-bindings.md) lists
every code. The CLI exits unsuccessfully on failure. See the
[full API](https://jsr.io/@colibri/contract-bindings/doc) and
[CLI API](https://jsr.io/@colibri/contract-bindings/doc/cli).

If invoke succeeds but decoding its result fails, the generated client throws
Core `ColibriError` code `CONTR_021`, retaining the successful transaction
result in `meta.data.result` and the original codec failure in `meta.cause`.
Inspect that result and the embedded ABI before deciding the next action;
resubmitting would create another transaction.

[Package overview](../contract-bindings.md)
