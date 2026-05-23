# Core Plugins

Core plugins are built into `@colibri/core` and extend Colibri's internal
pipelines without requiring a separate plugin package.

Use core plugins when you want to customize the behavior of built-in steps such
as `simulate-transaction` while keeping the standard pipeline flow.

## Available Core Plugins

| Plugin                                              | Target                 | Description                                                                              |
| --------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| [Contract Error Matcher](contract-error-matcher.md) | `simulate-transaction` | Converts recognized contract simulation errors into known, human-readable Colibri errors |

## Using Core Plugins

Attach a core plugin to a pipeline with `pipeline.use(...)`:

```ts
import {
  createContractErrorMatcherPlugin,
  createInvokeContractPipeline,
  NetworkConfig,
} from "@colibri/core";

const pipeline = createInvokeContractPipeline({
  networkConfig: NetworkConfig.TestNet(),
});

pipeline.use(
  createContractErrorMatcherPlugin({
    1: { message: "Unauthorized" },
  }),
);
```

Some core plugins also have higher-level client helpers. For contract error
matching, call `contract.loadContractErrorsFromWasm(...)` to derive the mapping
from a loaded contract spec or WASM, or pass plugins intentionally through
`ContractConfig.plugins`.

## Related Pages

- [Contract Error Matcher](contract-error-matcher.md)
- [Contract](../contract.md)
- [SimulateTransaction](../processes/simulate-transaction.md)
- [Pipelines](../pipelines/README.md)
