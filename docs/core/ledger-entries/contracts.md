# Contract data and executables

[Ledger Entries overview](../ledger-entries.md)

## Contract Data Notes

Classic Stellar entry kinds have well-defined decoded shapes. Contract storage
does not.

That means `contractData(...)` gives you a friendly wrapper around the entry,
but it does **not** try to infer a contract-specific application schema.
Instead, it gives you access to the parsed key/value forms so you can decode
them according to your own contract conventions.

```ts
import { LedgerEntries, NetworkConfig } from "@colibri/core";
import { xdr } from "npm:@stellar/stellar-sdk";

const ledger = new LedgerEntries({
  networkConfig: NetworkConfig.TestNet(),
});

const data = await ledger.contractData({
  contractId: "CA...",
  key: xdr.ScVal.scvSymbol("counter"),
});

console.log(data.key);
console.log(data.value);
```

## Contract Code Lookup

`contractCode(...)` supports two lookup styles:

- by explicit wasm hash
- by `contractId`, resolving the contract instance first

```ts
const code = await ledger.contractCode({
  contractId: "CA...",
});

console.log(code.hash);
console.log(code.code.length);
```

For a contract using a CAP-85 external executable reference, resolution follows
the owner/tag entry to its current Wasm hash. To start from an external
reference, call `resolveContractExecutable({ externalRef })` and then
`contractCode({ hash: resolved.resolvedWasmHash })` on the Wasm result. The
external-reference result is an observation, not a permanent association: repeat
the read after upgrades.

Stellar Asset Contracts use a built-in executable rather than uploaded Wasm; do
not treat them as a downloadable Rust build artifact. Build Verification reports
that target category as `notApplicable`.
