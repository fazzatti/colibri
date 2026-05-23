# Contract Error Matcher

The contract error matcher is a core plugin for the `simulate-transaction` step.
It helps applications turn numeric contract errors from failed Soroban
simulation responses into known, human-readable Colibri errors.

## Why Use It?

Soroban RPC surfaces contract failures as numeric codes such as
`Error(Contract, #265)`. Those codes are useful, but applications usually need
to map them back to a contract-specific enum or binding-generated message. When
contract error specs include documentation comments, Colibri can also carry
those docs as optional error details.

The matcher plugin does that mapping at the simulation boundary:

1. `simulateTransaction` identifies a failed simulation with a contract error.
2. Colibri throws `CONTRACT_ERROR_SIMULATION_FAILED` with parsed diagnostic
   metadata.
3. The plugin checks the parsed contract-error stack against your known error
   map.
4. If a match is found, it throws `KNOWN_CONTRACT_ERROR_SIMULATION_FAILED`.

The original simulation error remains available as `error.meta.cause`, so you
can still inspect the raw simulation response and parsed diagnostic stack.

## Basic Usage

Use a plain error-code map when one mapping applies to every relevant contract
in the simulation:

```ts
import {
  ColibriError,
  createContractErrorMatcherPlugin,
  createInvokeContractPipeline,
  NetworkConfig,
} from "@colibri/core";

const pipeline = createInvokeContractPipeline({
  networkConfig: NetworkConfig.TestNet(),
});

pipeline.use(
  createContractErrorMatcherPlugin({
    1: {
      message: "Unauthorized",
      details: "The caller is not authorized to run this operation.",
    },
    265: { message: "InsufficientBalance" },
  }),
);
```

If simulation fails with contract error `#265`, the plugin throws:

```ts
try {
  await pipeline.run(input);
} catch (error) {
  if (ColibriError.is(error) && error.code === "PLG_SIM_CEM_001") {
    console.log(error.message); // "Contract error: InsufficientBalance"
    console.log(error.meta.data.match.code); // 265
    console.log(error.meta.cause); // Original CONTRACT_ERROR_SIMULATION_FAILED
  }
}
```

## Use With `Contract`

For the high-level `Contract` client, use `loadContractErrorsFromWasm(...)` when
the contract spec or WASM contains error enum cases. Colibri derives the
error-code map and installs the matcher on both owned pipelines.

```ts
import { Contract, NetworkConfig } from "@colibri/core";

const contract = new Contract({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: {
    contractId: "C...",
    spec,
  },
});

await contract.loadContractErrorsFromWasm({ strategy: "any" });

await contract.invoke({
  method: "transfer",
  methodArgs: { to, amount },
  config,
});
```

This path is the simplest option when a generated contract client or application
owns one `Contract` instance and wants consistent error mapping for both reads
and writes. The loader uses the already loaded spec when available; otherwise it
loads the spec from local WASM or from deployed WASM through RPC. It throws if
the built-in matcher is already attached to either owned pipeline.

If you already have WASM bytes and only need the plain mapping, use
`extractContractErrorMapFromWasm(...)`:

```ts
import {
  createContractErrorMatcherPlugin,
  extractContractErrorMapFromWasm,
} from "@colibri/core";

const wasm = await Deno.readFile("./contract.wasm");
const errors = extractContractErrorMapFromWasm(wasm);

const matcher = createContractErrorMatcherPlugin(errors);
```

The extracted map uses the contract error enum case name as `message`. If an
error enum case has a non-empty doc string in the compiled spec, that text is
included as `details`.

For constructor-time plugin setup, use `contractConfig.plugins` and choose the
target pipeline explicitly:

```ts
import { createContractErrorMatcherPlugin } from "@colibri/core";

const matcher = createContractErrorMatcherPlugin({
  1: {
    message: "Unauthorized",
    details: "The caller is not authorized to run this operation.",
  },
  265: { message: "InsufficientBalance" },
});

const contract = new Contract({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: {
    contractId: "C...",
    spec,
    plugins: {
      invokePipe: [matcher],
      readPipe: [matcher],
    },
  },
});
```

## Matching Strategies

The plugin accepts either a plain map or an ordered list of matcher entries.

### Match Any Contract Error By Code

```ts
createContractErrorMatcherPlugin({
  1: { message: "Unauthorized" },
});
```

This is equivalent to:

```ts
createContractErrorMatcherPlugin([
  {
    strategy: "any",
    errors: {
      1: { message: "Unauthorized" },
    },
  },
]);
```

### Match A Specific Contract Id

Use `contract-id` when multiple contracts can emit the same numeric code with
different meanings.

```ts
createContractErrorMatcherPlugin([
  {
    strategy: "contract-id",
    contractId: tokenContractId,
    errors: {
      1: { message: "TokenUnauthorized" },
    },
  },
]);
```

### Match Root Or Sub-Invocation Errors

Use `issued-from` when you want to distinguish between the top-level contract
call and errors emitted by contracts it called.

```ts
createContractErrorMatcherPlugin([
  {
    strategy: "issued-from",
    issuedFrom: "root-invocation",
    errors: {
      1: { message: "RootContractUnauthorized" },
    },
  },
  {
    strategy: "issued-from",
    issuedFrom: "sub-invocation",
    errors: {
      1: { message: "SubContractUnauthorized" },
    },
  },
]);
```

Matcher entries are evaluated in the order you provide them. Put the most
specific matcher first when a code may appear in multiple places.

## Inspecting The Error

`KNOWN_CONTRACT_ERROR_SIMULATION_FAILED` contains a compact selected match:

```ts
console.log(error.meta.data.match);
```

The match includes:

| Field          | Description                                              |
| -------------- | -------------------------------------------------------- |
| `code`         | Numeric contract error code                              |
| `message`      | Message from your configured map                         |
| `details`      | Optional details from your map or extracted spec docs    |
| `contractId`   | Contract that emitted the matched diagnostic error event |
| `issuedFrom`   | `root-invocation` or `sub-invocation`                    |
| `eventIndex`   | Index of the diagnostic event that produced the match    |
| `strategy`     | Matcher strategy that matched                            |
| `matcherIndex` | Index of the matcher entry that matched                  |

When `details` is present, `KNOWN_CONTRACT_ERROR_SIMULATION_FAILED` also uses it
as `error.diagnostic.rootCause`.

For deeper analysis, inspect the original simulation error:

```ts
const original = error.meta.cause;
console.log(original.meta.data.contractError);
console.log(original.meta.data.contractErrorStack);
console.log(original.meta.data.diagnosticEvents);
```

## Related APIs

- `createContractErrorMatcherPlugin(...)`
- `extractContractErrorMapFromWasm(...)`
- `ContractConfig.plugins`
- `Contract.loadContractErrorsFromWasm(...)`
- `CONTRACT_ERROR_SIMULATION_FAILED`
- `KNOWN_CONTRACT_ERROR_SIMULATION_FAILED`
- `parseFailedSimulationResponse(...)`
