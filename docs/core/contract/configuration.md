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

## Network-loaded provenance and refresh

`await contract.loadSpecFromNetwork()` resolves the configured instance,
immutable Wasm hash, or external reference and loads its Wasm/spec. Only after
successful retrieval and parsing does it replace the local Wasm, spec, resolved
hash, and `LoadedContractSnapshot` together. A failed refresh leaves the
preceding loaded state intact. Metadata and claims continue to be extracted from
that loaded Wasm.

```ts
await contract.loadSpecFromNetwork();
const snapshot = contract.getLoadedSnapshot();
console.log(snapshot?.wasmHash, snapshot?.observedAtLedger);
console.log(snapshot?.instance, snapshot?.reference);
```

`getLoadedSnapshot()` returns a detached record, or `undefined` before a
successful network load. `observedAtLedger` is the code-read RPC ledger;
`instance` and `reference` retain their separate observations. These are not an
atomic snapshot of the network, nor a guarantee that an upgradeable reference
still points to the same code. Refresh is explicit, never automatic before
signing. `getContractCodeLedgerEntry()` is a read and does not refresh client
state. After a successful external-reference load, `getWasmHash()` exposes the
resolved immutable hash; `getExternalRef()` still describes the configured
deployment target.

- `ContractId` is the branded string type used for Soroban contract ids
- `TransactionConfig` is the shared write-transaction config shape
