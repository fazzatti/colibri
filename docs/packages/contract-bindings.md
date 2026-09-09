# Generate a Colibri contract client

`@colibri/contract-bindings` turns a Soroban contract spec into a `Contract`
subclass with typed `read` and `invoke`, embedded spec entries, a Colibri error
map, and typed event definitions. Its initial 0.1 release requires Core 1.1.

## Choose a source and output

Install Deno, then run the interactive wizard:

```sh
deno run --allow-read --allow-write --allow-net jsr:@colibri/contract-bindings/cli
```

Use **↑ / ↓** and **Enter** to select a WASM file, contract ID, or WASM hash,
then paste the value into its labeled prompt. Network sources offer **Mainnet**,
**Testnet**, **Futurenet**, and **Custom**. Custom asks for both an RPC URL and
a network passphrase. Output and JSR/npm presets also use menus. The generator
fetches through Core. It does not submit transactions. SACs have no downloadable
Wasm and cannot use these network source modes.

For automation, provide flags and disable prompts:

```sh
deno run --allow-read --allow-write --allow-net jsr:@colibri/contract-bindings/cli \
  --wasm ./contract.wasm --class-name Token \
  --output package --target jsr --package-name @example/token \
  --out ./token-client --non-interactive
```

Use `--contract-id C... --network testnet` or
`--wasm-hash HEX_HASH --network testnet` instead of `--wasm`. Optional
`--rpc-url` overrides the preset. Custom networks need `--network-passphrase`;
plain HTTP requires `--allow-http`. Local Wasm parsing requires no network
access after caching dependencies. `--help` describes every flag.

Partial commands prompt only for missing choices in a terminal. In automation,
missing required flags are errors. **Ctrl+C** or **Ctrl+D** cancels a prompt
without writing output files.

There is no class-name question: local `my_token.wasm` becomes `MyToken`.
Soroban specs have no contract-name field, so remote sources use
`ContractClient`, as do filenames that cannot form a valid client name. Use
`--class-name Token` to override the default.

Provenance is omitted by default. Add `--include-provenance` to emit a
`TokenProvenance` constant (when the class is `Token`) containing available
source identity and RPC observations. In the programmatic API, passing
`provenance: loaded.provenance` explicitly enables the same output.

## Use files, JSR, or npm

`--output files` emits `constants.ts` (method names, spec, errors), `types.ts`
(named inputs/outputs and mapped types), `index.ts` (the client and exports),
and a formatted `README.md` for an existing project. Configure imports in that
project: both presets import only `@colibri/core`; Core supplies the Stellar SDK
dependency and spec codec.

The generated `types.ts` is organized into labeled sections: methods and their
inputs/outputs/maps, contract-declared types when present, events, and client
configuration. Error maps use Core's `ContractErrorMap` type.

`--output package --target jsr` places the three source files in `generated/`,
with a `mod.ts` entrypoint and a `deno.json`. Run `deno task check` in the
output directory. `--target npm` creates a `package.json`, TypeScript build
configuration, `.npmrc`, and ESM exports. Run `npm install` and `npm run build`;
JavaScript and declarations appear in `dist/`. The SDK requires Node 22.12 or
newer. The npm package shares Core through an alias of `@jsr/colibri__core`,
using `https://npm.jsr.io` for the `@jsr` scope. Carry that registry
configuration into consuming projects and CI.

Review the package name, version, license, and publication settings before
publishing. Neither mode installs dependencies or publishes automatically.

Only generator-owned files are replaced by `--force`. Package scaffold and
handwritten setup are preserved, including customized dependency versions. Place
custom subclasses or assembly functions outside `generated/`. Writes are atomic
per file; a disk failure can leave only part of a multi-file plan written.
Resolve the failure and rerun.

## Understand the generated types

Every ABI method is available through **both** `read` and `invoke`. The ABI does
not say which functions write state, so the generator does not infer mutability
or add individual method wrappers. Choose simulation with `read`, or transaction
submission through Core's pipeline with `invoke`.

Method names remain correlated with their arguments and outputs. No-argument
functions can omit `methodArgs`. Invoke keeps Core's raw `returnValue`, hash,
ledger, timestamp, and RPC response and adds `value`; it is undefined when Core
has no return value.

The types match SDK decoding: large integers are bigint; bytes are Uint8Array;
void is null; missing Options decode to null; Maps decode to arrays of tuples.
Map inputs can also be JavaScript Maps, and Option inputs accept undefined.
Structs, tuple structs, tagged unions, and enums retain their native shapes.
Fixed byte sizes and integer bounds are runtime codec constraints. Top-level
Result uses the SDK Result wrapper with `{ message: string }` errors;
transaction failures may also throw Core errors. Unsupported SDK encodings such
as nested Result fail generation explicitly.

Types retain their spec names in PascalCase, such as `CounterSummary`. Functions
have named `GetCountInput`/`GetCountOutput` types and appear in the client
method map. An additional input variant is emitted only for SDK input shapes
that differ from decoded output. Repeated original names use the first SDK
declaration with a warning. Casing collisions fail explicitly instead of
introducing numerical type prefixes.

`ContractMethods` exposes PascalCase enum members with the exact ABI strings as
values, such as `GrantRole = "grant_role"`. Both `ContractMethods.GrantRole` and
`"grant_role"` retain correlated argument and return types in calls. Casing
collisions fail generation. Alias this import when combining several generated
clients in one module.

The generated class inherits `getLedgerEntry({ key, durability })` from Core for
direct contract-data reads. It supplies its contract ID and RPC automatically;
provide an encoded ScVal key and persistent/temporary durability (persistent by
default). It returns the existing ledger helper's parsed entry and raw metadata,
without a generated storage schema. See
[direct ledger reads](../core/contract/invocation.md#getledgerentry).

## Assemble errors and use events

For a generated `Token` class, `TokenErrors` maps numeric codes to
`{ name, category, message, details? }`. The case name and declaring error enum
come directly from the spec, while message and details can be customized.
Separate error enums are omitted; a numeric type alias remains only if another
ABI declaration references that error type. Supply a prepared `errors` object in
the constructor to customize messages. Automatic matching is installed once,
scoped to the contract ID when present, or to root-invocation errors before an
ID is available. Use `errors: false` when supplying your own matcher through
`contractConfig.plugins`. Other constructor plugins keep their Core semantics.
Spread the original entry when customizing a message to retain its metadata.
Matched errors surface `name` and `category` in `error.meta.data.match`. Core's
spec/WASM helpers and `Contract.loadContractErrorsFromWasm()` preserve these
fields too; manually supplied maps may omit them.

`token.events.Transfer` is a Core event definition when that name is declared in
the ABI. Its `toTopicFilter` and `toEventFilter` accept only indexed fields.
`fromEvent` validates exact topic count and types and single-value, vector, or
map payloads. The resulting `ContractEvent` retains the original ledger,
transaction, and raw-XDR information alongside typed `fields` and `get()`.

`tryFromEvent` returns undefined on a nonmatch. Registry `parse` throws if more
than one declaration matches; select the name and occurrence explicitly.
`events.bindings` records aliases for collisions with registry properties.
Contracts may emit events even when the spec contains no event declarations.

Core also supports dynamic event extraction without generating files. See
[spec-aware events](../core/contract/events.md).

## Generate programmatically

Install with `deno add jsr:@colibri/contract-bindings`. This complete script
reads an application-supplied `contract.wasm` and writes a JSR package:

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
  provenance: loaded.provenance,
});
const result = await writeBindings(plan, { directory: "./token-client" });
console.log(result.written, plan.warnings);
```

`loadBindingSource` also accepts an existing Spec, a contract ID, or a Wasm
hash. Network sources accept a `NetworkConfig` and optional RPC client. The
package root is portable; `/cli` is Deno-only. `generateBindings` performs no
I/O. `parseCliArgs`, `resolveCliOptions`, and `runCli` allow a custom prompt
interface.

The embedded ABI is a snapshot. Regenerate after a contract upgrade. Loading a
different spec into the typed class invalidates its type guarantees. Provenance
contains code hashes and separate RPC ledger observations, not an atomic network
snapshot or endpoint credentials.

Use `BindingError.code` for stable CLI/source/rendering/output failures and
inspect its cause for the Core or filesystem error. The CLI exits unsuccessfully
on failure. See the [full API](https://jsr.io/@colibri/contract-bindings/doc)
and [CLI API](https://jsr.io/@colibri/contract-bindings/doc/cli).

If invoke succeeds but decoding its result fails, the generated client throws
Core `ColibriError` code `CBG_006`, retaining the successful transaction result
in `meta.data.result` and the codec failure as its cause. Inspect that result
and the embedded ABI before deciding the next action; resubmitting would create
another transaction.

## Validated contract values

Newly generated inputs accept raw values and
[validated Soroban helpers](../core/contract/values.md). Output aliases such as
`SorobanType.U32` retain plain result shapes. Custom types use
`SorobanType.Custom` schemas, with struct/tuple fields or tagged/u32 enum
variants. Matching factories reuse the embedded spec. Numeric codes and
validation live on one factory. A custom input alias uses `ValueInput` if
`Input` would collide with a method's input name. The constants and error-map
layout is unchanged.
