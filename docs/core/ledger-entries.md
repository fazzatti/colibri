# Ledger Entries

`LedgerEntries` reads typed Stellar ledger entries through RPC. It is a
current-state reader, not a historical transaction index. Use convenience
[convenience methods](ledger-entries/reading.md#convenience-reads) for known
entry kinds, [branded key builders](ledger-entries/keys.md) for generic reads,
or [executable resolution](ledger-entries/contracts.md) for contract code.

## Guides

- [Read entries and handle missing data](ledger-entries/reading.md)
- [Ledger keys and TTL](ledger-entries/keys.md)
- [Contract data and executables](ledger-entries/contracts.md)

See the [API and error reference](../reference/README.md) for exact exported
symbols and complete error contexts.
