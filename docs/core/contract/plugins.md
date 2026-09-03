# Contract errors and pipeline plugins

[Contract overview](../contract.md)

## Known Contract Errors

`Contract` can install the core
[Contract Error Matcher](../plugins/contract-error-matcher.md) plugin on both
pipelines it owns. Use `loadContractErrorsFromWasm(...)` when the contract spec
or WASM contains error enum cases and you want Colibri to derive the mapping for
you.

```ts
import {
  Contract,
  KNOWN_CONTRACT_ERROR_SIMULATION_FAILED,
  NetworkConfig,
} from "@colibri/core";

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
  if (error instanceof KNOWN_CONTRACT_ERROR_SIMULATION_FAILED) {
    console.log(error.message); // "Contract error: InsufficientBalance"
    console.log(error.meta.data.match);
  }
}
```

`loadContractErrorsFromWasm(...)` uses the already loaded spec when available.
Otherwise it loads the spec from local WASM or resolves the currently selected
network WASM through RPC. It throws if the built-in matcher plugin is already
attached to either owned pipeline, so plugin ordering stays explicit.

For advanced flows, attach `createContractErrorMatcherPlugin(...)` directly to a
pipeline or pass plugins intentionally through `contractConfig.plugins`:

```ts
import { createContractErrorMatcherPlugin } from "@colibri/core";

const matcher = createContractErrorMatcherPlugin({
  1: {
    message: "Unauthorized",
    details: "The caller is not authorized to run this operation.",
  },
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
