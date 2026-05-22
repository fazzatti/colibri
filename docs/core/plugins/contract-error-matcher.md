# Contract Error Matcher

The contract error matcher is a core plugin for the `simulate-transaction` step.
It helps applications turn numeric contract errors from failed Soroban
simulation responses into known, human-readable Colibri errors.

## Why Use It?

Soroban RPC surfaces contract failures as numeric codes such as
`Error(Contract, #265)`. Those codes are useful, but applications usually need
to map them back to a contract-specific enum or binding-generated message.

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
    1: { message: "Unauthorized" },
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

For the high-level `Contract` client, pass the same mapping as `contractErrors`.
Colibri installs the matcher on both the read and invoke pipelines owned by that
contract instance.

```ts
import { Contract, NetworkConfig } from "@colibri/core";

const contract = new Contract({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: {
    contractId: "C...",
    spec,
    contractErrors: {
      1: { message: "Unauthorized" },
      265: { message: "InsufficientBalance" },
    },
  },
});

await contract.invoke({
  method: "transfer",
  methodArgs: { to, amount },
  config,
});
```

This path is the simplest option when a generated contract client or application
owns one `Contract` instance and wants consistent error mapping for both reads
and writes.

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
| `contractId`   | Contract that emitted the matched diagnostic error event |
| `issuedFrom`   | `root-invocation` or `sub-invocation`                    |
| `eventIndex`   | Index of the diagnostic event that produced the match    |
| `strategy`     | Matcher strategy that matched                            |
| `matcherIndex` | Index of the matcher entry that matched                  |

For deeper analysis, inspect the original simulation error:

```ts
const original = error.meta.cause;
console.log(original.meta.data.contractError);
console.log(original.meta.data.contractErrorStack);
console.log(original.meta.data.diagnosticEvents);
```

## Related APIs

- `createContractErrorMatcherPlugin(...)`
- `ContractConfig.contractErrors`
- `CONTRACT_ERROR_SIMULATION_FAILED`
- `KNOWN_CONTRACT_ERROR_SIMULATION_FAILED`
- `parseFailedSimulationResponse(...)`
