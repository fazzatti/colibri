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
