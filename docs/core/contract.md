# Contract

`Contract` is Colibri's high-level Soroban client. It owns both a read pipeline
and an invoke pipeline, and exposes helpers for deployment, invocation, and
state reads.

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
- `plugins` when you intentionally want to attach plugins to the owned read or
  invoke pipelines during construction

## Known Contract Errors

`Contract` can install the core
[Contract Error Matcher](plugins/contract-error-matcher.md) plugin on both
pipelines it owns. Use `loadContractErrorsFromWasm(...)` when the contract spec
or WASM contains error enum cases and you want Colibri to derive the mapping for
you.

```ts
import { ColibriError, Contract, NetworkConfig } from "@colibri/core";

const contract = new Contract({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: {
    contractId: "CABC...",
    spec,
  },
});

await contract.loadContractErrorsFromWasm({ strategy: "any" });

try {
  await contract.invoke({ method, methodArgs, config });
} catch (error) {
  if (ColibriError.is(error) && error.code === "PLG_SIM_CEM_001") {
    console.log(error.message); // "Contract error: InsufficientBalance"
    console.log(error.meta.data.match);
  }
}
```

`loadContractErrorsFromWasm(...)` uses the already loaded spec when available.
Otherwise it loads the spec from local WASM or from the deployed contract WASM
through RPC. It throws if the built-in matcher plugin is already attached to
either owned pipeline, so plugin ordering stays explicit.

For advanced flows, attach `createContractErrorMatcherPlugin(...)` directly to a
pipeline or pass plugins intentionally through `contractConfig.plugins`:

```ts
import { createContractErrorMatcherPlugin } from "@colibri/core";

const matcher = createContractErrorMatcherPlugin({
  1: { message: "Unauthorized" },
});

const contract = new Contract({
  networkConfig,
  contractConfig: {
    contractId: "CABC...",
    spec,
    plugins: {
      invokePipe: [matcher],
      readPipe: [matcher],
    },
  },
});
```

## Core Methods

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

## Deployment Helpers

### `uploadWasm()`

Uploads local wasm and stores the resulting hash on the instance.

### `deploy()`

Deploys a contract using the current wasm hash:

```ts
await contract.deploy({
  config: {
    fee: "10000000",
    timeout: 30,
    source: signer.publicKey(),
    signers: [signer],
  },
  constructorArgs: {
    owner: adminAddress,
  },
});
```

## Owned Pipelines

`Contract` exposes the pipelines it owns:

- `contract.invokePipe`
- `contract.readPipe`

That gives you an escape hatch for advanced orchestration:

```ts
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";

contract.invokePipe.use(
  createFeeBumpPlugin({
    networkConfig,
    feeBumpConfig: {
      source: sponsor.publicKey(),
      fee: "1000000",
      signers: [sponsor],
    },
  }),
);
```

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

## Related Types

- `ContractId` is the branded string type used for Soroban contract ids
- `TransactionConfig` is the shared write-transaction config shape

## Notes

- For Stellar Asset Contracts, use the dedicated
  [Stellar Asset Contract](asset/stellar-asset-contract.md) client
- `Contract` stays close to `stellar-sdk`, so advanced flows can still combine
  SDK operations with Colibri orchestration

## Next Steps

- [Stellar Asset Contract](asset/stellar-asset-contract.md) — SAC-specific
  contract client
- [Pipelines](pipelines/README.md) — Built-in orchestration flows
- [Network](network.md) — Network configuration
