# Colibri Contract Bindings

Generate a typed Colibri `Contract` subclass from a Soroban Wasm file, a
deployed contract ID, or an uploaded Wasm hash. The package exports a portable
rendering API and a Deno CLI with interactive prompts and automation flags.

Generated clients import `Spec` and the native `Result` type from
`@colibri/core`. JSR and npm scaffolds declare only Core as a runtime
dependency. Core provides the Stellar SDK internally, so consumers do not need
to add it just for the spec.

This initial 0.1 preview requires Colibri Core 1.1 and Stellar SDK 17.0.1 or a
compatible 17.x release. The CLI runs on Deno; generated packages target **JSR
or npm**, independently of the runtime used to run the generator.

## CLI

Start the wizard in a terminal. Move the cursor with **↑ / ↓** and press
**Enter** to select an option. Type or paste identifiers, paths, and URLs when
prompted; **Ctrl+C** or **Ctrl+D** cancels before any files are written:

```sh
deno run --allow-read --allow-write --allow-net jsr:@colibri/contract-bindings/cli
```

Or supply flags. Local Wasm generation needs no network permission after
installing/caching the tool's dependencies:

```sh
deno run --allow-read --allow-write jsr:@colibri/contract-bindings/cli \
  --wasm ./token.wasm --out ./token-client \
  --output package --target jsr --package-name @example/token \
  --non-interactive
```

For network sources, replace `--wasm` with **one** of `--contract-id C...` or
`--wasm-hash HEX_HASH`, add `--network testnet|futurenet|mainnet|custom`, and
grant network permission. Use `--rpc-url` to override a preset; custom networks
also require `--network-passphrase`. HTTP requires `--allow-http`. Generation
only reads code and its spec; it never deploys or submits a transaction. Stellar
Asset Contracts have no downloadable Wasm and receive Core's typed source error.

No flags start the wizard; partial flags preserve supplied answers and ask for
missing choices. A complete command needs no prompts. `--non-interactive` always
disables prompting. Nonterminal runs fail on missing required values. `--help`
lists every flag.

The source menu offers **WASM file**, **Contract ID**, and **WASM hash**. After
selection, the next prompt explicitly names the value to enter. The network menu
offers **Mainnet**, **Testnet**, **Futurenet**, and **Custom**; Custom asks for
both the RPC URL and network passphrase. Output and JSR/npm presets also use
menus. Supplied flags skip their corresponding questions.

The wizard does not ask for a class name. Soroban specs contain names for ABI
members, but no contract name. For a local file, the CLI uses its filename in
PascalCase (`my_token.wasm` → `MyToken`). Remote sources and filenames that
cannot form a valid client name use `ContractClient`. Override either with
`--class-name Token`; the completion message shows the chosen class name.

Source provenance is **omitted by default**. Add `--include-provenance` when you
want a `TokenProvenance` export (for a `Token` class) in `constants.ts`,
including the available contract ID, resolved WASM hash, and RPC observations:

```sh
deno run --allow-read --allow-write jsr:@colibri/contract-bindings/cli \
  --wasm ./token.wasm --out ./token-client --include-provenance --non-interactive
```

## Files or packages

- `--output files` produces `constants.ts`, `types.ts`, `index.ts`, and a
  formatted `README.md` with setup instructions and examples from the spec.
  Configure the imports in your host project. The default `--target jsr` uses
  `@colibri/core` and `stellar-sdk/contract`; the npm preset uses
  `@stellar/stellar-sdk/contract`.
- `--output package --target jsr` adds `mod.ts`, `deno.json`, and a README. Run
  `deno task check`; JSR exports the TypeScript source.
- `--output package --target npm` adds `package.json`, `tsconfig.json`,
  `.npmrc`, `mod.ts`, and a README. Run `npm install` and `npm run build` to
  produce ESM JavaScript and declarations in `dist/`. Core remains a shared
  dependency via the `@jsr/colibri__core` npm alias. Preserve the `@jsr`
  registry configuration in consuming projects and CI. Node 22.12 or newer is
  required by the SDK.

Review your package name, version, license, and publishing settings before
publishing. Generating a package does not publish or install dependencies.

`--force` replaces only files marked as generator-owned. Existing package
scaffold and handwritten code remain untouched. The writer checks paths and
conflicts before writing, rejects symbolic links inside the destination, and
replaces each file atomically. A multi-file write is not a filesystem
transaction; if the disk fails during a write, rerun after resolving the
failure.

## Generated client

The following fragment assumes your generated `Token` ABI has `balance` and
`transfer` functions and a `Transfer` event. Exact method and field names come
from your spec:

```ts
const token = new Token({
  networkConfig,
  contractConfig: { contractId },
});
const balance = await token.read({
  method: "balance",
  methodArgs: { account: address },
}); // bigint
const result = await token.invoke({
  method: "transfer",
  methodArgs: { from: address, to: recipient, amount: 100n },
  config: transactionConfig,
});
console.log(result.value, result.returnValue, result.hash);
```

The ABI cannot safely identify reads versus writes. Every function is available
through both typed entry points; no individual method wrappers or mutability
heuristics are generated. `read()` simulates, while `invoke()` uses Core's
transaction pipeline, preserving raw `returnValue` and metadata and adding a
decoded `value`. That value is `undefined` when Core has no return value.

The output includes a complete method map plus mapped input/output types. Native
representations follow the installed SDK: large integers are `bigint`, bytes are
`Uint8Array`, void outputs are `null`, missing Options decode to `null`, and
Maps decode to arrays of `[key, value]` tuples. Inputs also accept `Map` and
undefined Options. UDTs retain named struct fields, tuple structs, enum values,
and tagged union variants. Fixed byte lengths and integer ranges are checked by
the codec. Top-level function `Result` outputs use the SDK
`Result<T, { message: string }>` wrapper; failures may also throw through Core.
Unsupported native SDK types, including nested Result encodings, fail generation
explicitly.

`ContractMethods` is a string enum shared by the generated files. Its members
use PascalCase while their values retain the exact ABI spelling:

```ts
export enum ContractMethods {
  GrantRole = "grant_role",
  HasRole = "has_role",
}
```

Calls accept both `ContractMethods.GrantRole` and the literal `"grant_role"`,
with the same argument and result checking. Import it alongside your generated
client; alias the import when using multiple clients in one module.

Contract types use their spec names in PascalCase, such as `CounterSummary`.
Function arguments and results receive names such as `GetCountInput` and
`GetCountOutput`. An additional `CounterSummaryInput` is emitted only when the
SDK accepts a different input shape (for example, nested Maps or Options).
Fields and union tags retain their ABI spelling. Repeated original type names
use the first declaration, matching the SDK, with a generation warning. Distinct
names that collide after casing cause an explicit error; they are never
numbered.

## Errors and events

For a `Token` class, `TokenErrors` is the numeric error map in Colibri's
`KnownContractErrorMap` format. The constructor installs it once, scoped to the
contract ID when one exists; otherwise it matches root-invocation errors only.
Prepare custom messages ahead of construction:

Each generated error contains its original case `name`, declaring error enum
`category`, display `message`, and optional documentation in `details`. Category
preserves the spec enum name without inferring a business classification.
Separate runtime error enums are omitted. An error enum referenced by another
ABI type is retained only as a numeric union type, with no runtime object.

```ts
const token = new Token({
  networkConfig,
  contractConfig: { contractId },
  errors: {
    ...TokenErrors,
    7: {
      ...TokenErrors[7],
      message: "Not authorized",
      details: "Ask the token administrator.",
    },
  },
});
```

Use `errors: false` when installing your own matcher through
`contractConfig.plugins`. Additional plugins retain Core's existing constructor
semantics. There is no new mutable error installation method. Matched failures
expose the preserved fields through `error.meta.data.match.name` and
`error.meta.data.match.category`. Manual maps may omit these fields; Core's spec
and WASM extraction helpers populate them.

Declared events use Core's reusable `ContractEventDefinition`:

```ts
const filter = token.events.Transfer.toEventFilter({ from: address });
const transfer = token.events.Transfer.fromEvent(event);
console.log(transfer.fields.amount, transfer.ledger, transfer.txHash);
```

Only indexed fields can be filtered. Decoding validates exact topics, field
counts and native types, supports single-value/vector/map data, and preserves
Colibri event metadata and raw XDR. `tryFromEvent` returns undefined for a
nonmatch. Registry `parse` rejects ambiguous matches; select a definition by
name and occurrence in that case. `events.bindings` maps original names to safe
properties when names collide with registry methods. No event declarations does
not mean no events are emitted.

## Programmatic API

Install with `deno add jsr:@colibri/contract-bindings`. This complete example
renders a small spec in memory; replace the spec with `loadBindingSource` for
Wasm or network sources:

```ts
import { generateBindings } from "@colibri/contract-bindings";
import { Spec } from "@colibri/core";
import { xdr } from "stellar-sdk";

const spec = new Spec([
  xdr.ScSpecEntry.scSpecEntryFunctionV0(
    new xdr.ScSpecFunctionV0({
      name: "ping",
      doc: "Ping",
      inputs: [],
      outputs: [],
    }),
  ),
]);
const plan = generateBindings(spec, { className: "PingClient" });
console.log(plan.files["index.ts"]);
```

`loadBindingSource` accepts `{ kind: "wasm", wasm }`, `{ kind: "spec", spec }`,
`{ kind: "contract", contractId, networkConfig, rpc? }`, or
`{ kind: "hash", wasmHash, networkConfig, rpc? }`. To include source identity,
explicitly pass its `provenance` to `generateBindings`; otherwise no provenance
export is emitted. The Deno-only `/cli` subpath exports `writeBindings`,
`runCli`, and injectable prompt interfaces. The root renderer performs no
filesystem access and can be used in Node or browser tooling.

Generated specs are snapshots. Regenerate after an ABI change; loading another
spec into a generated class invalidates its type guarantees. Source provenance
when requested records the exact resolved Wasm hash and separate RPC
observations, not an atomic network snapshot. RPC URLs and credentials are not
embedded in generated code.

See the [API reference](https://jsr.io/@colibri/contract-bindings/doc).

If invoke succeeds but decoding its result fails, the generated client throws
Core `ColibriError` code `CBG_006`, retaining the successful transaction result
in `meta.data.result` and the codec failure as its cause. Inspect that result
and the embedded ABI before deciding the next action; resubmitting would create
another transaction.
