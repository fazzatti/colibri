# Programmatic generation

## Generate programmatically

Install with `deno add jsr:@colibri/contract-bindings`. This complete script
reads an application-supplied `contract.wasm` and writes a JSR package. Save it
as `generate.ts` and run `deno run --allow-read --allow-write generate.ts`:

<!-- deno-check -->

```ts
import {
  generateBindings,
  loadBindingSource,
} from "@colibri/contract-bindings";
import { writeBindings } from "@colibri/contract-bindings/cli";

const loaded = await loadBindingSource({
  kind: "wasm",
  wasm: await Deno.readFile("./contract.wasm"),
});
const plan = generateBindings(loaded.spec, {
  className: "Token",
  output: "package",
  target: "jsr",
  packageName: "@example/token",
  includeColibri: false,
  provenance: loaded.provenance,
});
const result = await writeBindings(plan, { directory: "./token-client" });
console.log(result.written, plan.warnings);
```

This example omits convenience re-exports so consuming code imports helpers from
Core directly. Remove `includeColibri: false` to include them.

### Source variants

`loadBindingSource` accepts one discriminated source object:

| `kind`       | Required fields               | Optional fields                 |
| ------------ | ----------------------------- | ------------------------------- |
| `"wasm"`     | `wasm: Uint8Array`            | —                               |
| `"spec"`     | `spec: Spec`                  | —                               |
| `"contract"` | `contractId`, `networkConfig` | Native Stellar SDK `rpc` client |
| `"hash"`     | `wasmHash`, `networkConfig`   | Native Stellar SDK `rpc` client |

It returns `{ spec, provenance }`. Pass a Colibri `NetworkConfig` for network
sources; a supplied RPC client is reused. Existing specs and Wasm bytes need no
network lookup. To render a spec you already have, call `generateBindings`
directly instead of loading a source again.

### Rendering and writing

`generateBindings(spec, options)` returns a plan without filesystem or network
access. Its default class is `ContractClient` (filename-based naming belongs to
the CLI), output is `files`, and target is `jsr`. Package output requires
`packageName`. `includeColibri` defaults to `true`; set it to `false` to omit
the convenience module and exports. The return value separates:

- `files`: generator-owned relative paths and source contents;
- `scaffold`: initial package/setup files to preserve when they already exist;
- `warnings`: ABI or naming details requiring review.

Node and browser tooling can consume that plan using their own filesystem or
editor APIs. `writeBindings(plan, { directory, force? })` is the Deno writer; it
returns `{ written, preserved }` paths. Rendering never installs dependencies or
writes files itself. Passing `provenance: loaded.provenance`, as above,
explicitly opts into provenance; omit it for the default smaller output.

### Public exports and custom prompts

The root exports `generateBindings`, `loadBindingSource`, `Spec`,
`BindingError`, `Code`, `BINDING_ERRORS`, and the `BindingSource`,
`BindingProvenance`, `LoadedBindingSource`, `GenerateBindingsOptions` and
`GeneratedBindings` types. `Spec` is the same constructor provided by Core.

The Deno-only `/cli` subpath exports `runCli`, `parseCliArgs`,
`resolveCliOptions`, `writeBindings`, `CLI_HELP`, and the `CliFlags`, `CliIO`,
`WriteBindingsOptions`, `WriteBindingsResult` and `GeneratedBindings` types.

For a custom interface, pass `runCli(args, io)` a `CliIO` with `interactive`,
`prompt` and `log`, plus an optional `select` callback for menus. A prompt
returns the answer or `null` to cancel. Its optional validation callback returns
`true` or a field-specific message, synchronously or asynchronously. Adapters
that omit validation receive feedback through `log` and are prompted again.
`parseCliArgs` parses without I/O; `resolveCliOptions` validates flags and asks
for missing choices before source loading.

[Package overview](../contract-bindings.md)
