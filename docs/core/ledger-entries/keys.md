# Ledger keys and TTL

[Ledger Entries overview](../ledger-entries.md)

## Ledger Key Builders

The ledger-entry module also exports granular key builders so advanced callers
can work directly with `xdr.LedgerKey` values:

- `buildAccountLedgerKey(...)`
- `buildTrustlineLedgerKey(...)`
- `buildOfferLedgerKey(...)`
- `buildDataLedgerKey(...)`
- `buildClaimableBalanceLedgerKey(...)`
- `buildLiquidityPoolLedgerKey(...)`
- `buildContractDataLedgerKey(...)`
- `buildContractInstanceLedgerKey(...)`
- `buildContractCodeLedgerKey(...)`
- `buildConfigSettingLedgerKey(...)`
- `buildTtlLedgerKey(...)`
- `hashLedgerKey(...)`

These builders return plain `xdr.LedgerKey` objects at runtime, but Colibri
brands them at the type level so `get(...)` and `getMany(...)` can preserve the
expected entry type when you use the exported builders.

## TTL Keys

The module can build TTL keys and TTL key hashes:

```ts
import {
  buildContractInstanceLedgerKey,
  buildTtlLedgerKey,
  hashLedgerKey,
} from "@colibri/core";

const contractKey = buildContractInstanceLedgerKey({
  contractId: "CA...",
});

const ttlKey = buildTtlLedgerKey({ key: contractKey });
const keyHash = hashLedgerKey(contractKey);
```

However, direct TTL reads are not exposed through `LedgerEntries` because the
shared RPC ledger-entry read path does not support them cleanly today.
