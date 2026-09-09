# Read and invoke

[Contract overview](../contract.md)

## Core Methods

The following are fragments using a configured `contract`, a signer, and the
application's addresses. Before named-argument `read()`/`invoke()`, provide a
`spec` during construction or call `loadSpecFromNetwork()` (or
`loadSpecFromWasm()` for local bytes). See the
[complete contract tutorial](../../getting-started/contract-call.md).

### `invoke()`

Use this for state-changing methods:

```ts
const result = await contract.invoke({
  method: "transfer",
  methodArgs: {
    from: "GABC...",
    to: "GDEF...",
    amount: 1000000n,
  },
  config: {
    fee: "10000000",
    timeout: 30,
    source: signer.publicKey(),
    signers: [signer],
  },
});
```

### `read()`

Use this for read-only methods:

```ts
const balance = await contract.read({
  method: "balance",
  methodArgs: {
    id: "GABC...",
  },
});
```

### `invokeRaw()` / `readRaw()`

Use the raw variants when you already have encoded ScVal arguments.

### `getLedgerEntry()`

Read a stored contract-data entry directly through the client's RPC connection.
The client supplies its contract ID; you supply the encoded ScVal key and
`"persistent"` or `"temporary"` durability. Persistent is the default. No spec,
source account, signer or simulation is needed. Generated clients inherit this
method from `Contract`.

This complete Deno example takes a Testnet contract ID and a symbol key as its
two arguments. For other key shapes, supply the corresponding encoded ScVal:

<!-- deno-check -->

```ts
import { Contract, type ContractId, NetworkConfig } from "@colibri/core";
import { xdr } from "stellar-sdk";

const [contractId, keyName] = Deno.args;
if (!contractId || !keyName) {
  throw new Error("Provide a contract ID and a symbol key.");
}
const contract = new Contract({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: { contractId: contractId as ContractId },
});
const entry = await contract.getLedgerEntry({
  key: xdr.ScVal.scvSymbol(keyName),
  durability: "persistent",
});
console.log(entry.value, entry.lastModifiedLedgerSeq, entry.liveUntilLedgerSeq);
console.log(entry.valueScVal);
```

The result and failure behavior are those of `LedgerEntries.contractData()`:
parsed key/value data, raw XDR and ledger metadata, with
`LEDGER_ENTRY_NOT_FOUND` when the entry is absent. A client without a deployed
contract ID raises `MISSING_REQUIRED_PROPERTY` before contacting RPC. The method
does not infer a storage schema or run a getter's default/computed behavior.
Instance storage is a map inside the shared instance entry, rather than a third
contract-data durability; use `LedgerEntries.contractInstance()` for that path.
See [contract data](../ledger-entries/contracts.md).

## Using Pipeline Factories Directly

If you want the raw flow without the `Contract` client:

```ts
import {
  createInvokeContractPipeline,
  createReadFromContractPipeline,
  NetworkConfig,
} from "@colibri/core";

const invokePipe = createInvokeContractPipeline({
  networkConfig: NetworkConfig.TestNet(),
});

const readPipe = createReadFromContractPipeline({
  networkConfig: NetworkConfig.TestNet(),
});
```
