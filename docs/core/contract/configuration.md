# Configure a contract client

[Contract overview](../contract.md)

## Creating A Contract Instance

```ts
import { ColibriError, Contract, NetworkConfig } from "@colibri/core";

const network = NetworkConfig.TestNet();

const contract = new Contract({
  networkConfig: network,
  contractConfig: {
    contractId: "CABC...",
  },
});
```

Other construction shapes are also supported:

- `contractId` for an already-deployed contract
- `wasm` when you have local contract bytes
- `wasmHash` when the wasm is already uploaded
- `externalRef` for a CAP-85 owner/tag mapping that selects the current wasm
- `plugins` when you intentionally want to attach plugins to the owned read or
  invoke pipelines during construction

These executable sources are mutually exclusive. Use an external reference when
the contract should follow a mapping controlled by another contract:

```ts
const contract = new Contract({
  networkConfig: network,
  contractConfig: {
    externalRef: {
      owner: "COWNER...",
      tag: "stable",
    },
  },
});
```

The owner and tag identify a protocol-defined persistent ledger entry. Colibri
does not prescribe how the owner contract manages that entry; applications can
invoke their own manager contract through the normal `Contract` API.

## Related Types

Read configured/resolved state through `getContractId()`, `getWasm()`,
`getWasmHash()`, and `getExternalRef()`. These getters throw a typed
missing-property error if that value has not been configured or produced yet.
For example, a Wasm-only client has no instance ID until deployment succeeds.
The protected `contractId` field is not the public accessor.

- `ContractId` is the branded string type used for Soroban contract ids
- `TransactionConfig` is the shared write-transaction config shape
