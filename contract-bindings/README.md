# @colibri/contract-bindings

Generate typed Colibri contract clients from Soroban Wasm files, deployed
contract IDs, or Wasm hashes. Each client includes typed calls, contract types,
an embedded spec, errors, and declared events. Output source files for an
existing project or a standalone JSR/npm package.

[Developer guide](https://fifo-docs.gitbook.io/colibri/packages/contract-bindings)
· [API reference](https://jsr.io/@colibri/contract-bindings/doc)

## Generate bindings

Run the interactive CLI with Deno:

```sh
deno run --allow-read --allow-write --allow-net jsr:@colibri/contract-bindings/cli
```

Choose the source, network and output with the arrow keys, then enter the
requested values. For scripts, supply flags instead:

```sh
deno run --allow-read --allow-write jsr:@colibri/contract-bindings/cli \
  --wasm ./token.wasm --class-name Token \
  --output files --out ./token-client --non-interactive
```

For a package, use `--output package --target jsr` (or `npm`) and
`--package-name @example/token`. Network sources use `--contract-id` or
`--wasm-hash`, plus `--network` and network permission. See the
[CLI options](https://fifo-docs.gitbook.io/colibri/packages/contract-bindings#cli-options)
for defaults and custom networks.

## Use a generated client

This fragment assumes the generated `Token` contract has `balance` and
`transfer` methods. Supply your contract ID, addresses and transaction
configuration; method arguments follow your contract's spec.

```ts
import { Token } from "./token-client/index.ts";
import { NetworkConfig } from "./token-client/colibri.ts";

const token = new Token({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: { contractId },
});
const balance = await token.balance.read({ account: address });
const result = await token.transfer.invoke({
  methodArgs: { from: address, to: recipient, amount: 100n },
  config: transactionConfig,
});
console.log(balance, result.value, result.hash);
```

Each method offers `.read()` for simulation and `.invoke()` for submission; the
spec cannot distinguish reads from writes. Typed generic `read` and `invoke`
calls remain available.

Generated files separate the client (`index.ts`), method/spec/error constants
(`constants.ts`), types and factories (`types.ts`), and shared Core conveniences
(`colibri.ts`). A contract-specific README explains the generated API.

## Programmatic generation

Install with `deno add jsr:@colibri/contract-bindings`. This Deno example reads
your Wasm and renders files in memory:

<!-- deno-check -->

```ts
import {
  generateBindings,
  loadBindingSource,
} from "@colibri/contract-bindings";

const { spec } = await loadBindingSource({
  kind: "wasm",
  wasm: await Deno.readFile("./token.wasm"),
});
const bindings = generateBindings(spec, { className: "Token" });
console.log(bindings.files["index.ts"]);
```

Run with `--allow-read`. Use `writeBindings` from the Deno-only `/cli` subpath
to save the result. The renderer itself performs no I/O and supports Node and
browser tooling.

## Exports

- **`@colibri/contract-bindings`**: `generateBindings`, `loadBindingSource`,
  `Spec`, `BindingError`, `Code`, `BINDING_ERRORS`, and source, generation and
  output-plan types.
- **`@colibri/contract-bindings/cli`**: `runCli`, `parseCliArgs`,
  `resolveCliOptions`, `writeBindings`, `CLI_HELP`, and CLI/writer types.

## Important details

- Generated clients require **Core 1.1 or a compatible 1.x release**. Package
  scaffolds declare Core as their runtime dependency; files-only output needs it
  configured in your project. No direct Stellar SDK dependency is needed just to
  use the bindings.
- Regenerate after an ABI change. `--force` replaces generator-owned files while
  preserving existing package scaffolds and handwritten files.
- Provenance is opt-in with `--include-provenance`. Errors and events come from
  the spec; undeclared events cannot be inferred.
- If submission succeeds but result decoding fails, `CONTR_021` preserves the
  successful transaction in `meta.data.result`. Inspect it before retrying.

See the
[developer guide](https://fifo-docs.gitbook.io/colibri/packages/contract-bindings)
for package setup, custom types, signing, errors, events and regeneration.
