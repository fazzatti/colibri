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

Each input is checked before advancing. An invalid answer shows a field-specific
message and stays editable; for example, pasting a function name at the contract
ID prompt does not advance to network selection. Contract IDs require a valid
C-address checksum, and WASM hashes require exactly 64 hexadecimal characters.
The CLI also checks readable input file paths, output directory paths, RPC URL
syntax and HTTP opt-in, nonblank passphrases, and class/package names. These
local checks do not contact RPC or prove that a contract exists on the chosen
network. Invalid supplied flags fail before prompting or loading a source.
Custom prompt adapters may use the optional validation callback; adapters that
omit it receive validation feedback through `log` and are prompted again.

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

- `--output files` produces `constants.ts`, `types.ts`, `index.ts`, `colibri.ts`, and a
  formatted `README.md` with setup instructions and examples from the spec.
  Configure the imports in your host project. Both presets import only
  `@colibri/core`, which supplies the Stellar SDK dependency and spec codec.
- `--output package --target jsr` adds `mod.ts`, `deno.json`, and a README. Run
  `deno task check`; JSR exports the TypeScript source.
- `--output package --target npm` adds `package.json`, `tsconfig.json`,
  `.npmrc`, `mod.ts`, and a README. Run `npm install` and `npm run build` to
  produce ESM JavaScript and declarations in `dist/`. Core remains a shared
  dependency via the `@jsr/colibri__core` npm alias. Preserve the `@jsr`
  registry configuration in consuming projects and CI. Node 22.12 or newer is
  required by the SDK.

`types.ts` groups its declarations into labeled sections: methods (named inputs
and outputs, method maps and call types), contract-declared types, events, and
client configuration. The contract-types section appears when the spec has
declarations to emit.

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
const balance = await token.balance.read({ account: address }); // bigint
const result = await token.transfer.invoke({
  methodArgs: { from: address, to: recipient, amount: 100n },
  config: transactionConfig,
});
console.log(result.value, result.returnValue, result.hash);
```

The ABI cannot safely identify reads versus writes. Every function gets a
property with both `.read()` and `.invoke()`; you choose which to call. Pass the
method's argument object directly to `.read()`. Invocations take a single object
with `methodArgs`, `config`, and optional `auth`, matching the generic
invocation with only `method` supplied by the helper. Argument-free methods use
`.read()` and `.invoke({ config })`; their `methodArgs` can be omitted. Helpers
retain the client when destructured. `read()` simulates, while `invoke()` uses
Core's transaction pipeline, preserving raw `returnValue` and metadata and
adding a decoded `value`. That value is `undefined` when Core has no return
value.

The generic `token.read({ method, methodArgs })` and
`token.invoke({ method, methodArgs, config, auth })` calls remain available.
Properties keep their exact ABI spelling, such as `token.grant_role.read(...)`.
If a name collides with a client member or JavaScript hook, the generator
appends `Method`: an ABI function `read` becomes `token.readMethod.read()`. The
suffix repeats if needed to avoid another ABI name. Generation warnings and the
generated README's function table report the exact property. The original ABI
method name is always sent to Core.

Generated clients also inherit `getLedgerEntry({ key, durability })` from Core.
Supply an encoded ScVal key and optional `"persistent"` (default) or
`"temporary"` durability; the client uses its bound contract ID and RPC to
return the existing contract-data entry with parsed values, raw XDR and ledger
metadata. This direct read requires no spec or transaction configuration and
preserves the ledger helper's missing-entry error. No storage schema is
generated.

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
`GetCountOutput`. Each custom declaration also receives a factory argument
alias, such as `CounterSummaryArgs`, accepting raw values or validated wrappers.
Method input fields reuse these aliases when they accept a custom type. Fields
and union tags retain their ABI spelling. Repeated original type names use the
first declaration, matching the SDK, with a generation warning. Distinct names
that collide after casing cause an explicit error; they are never numbered.

## Errors and events

For a `Token` class, `TokenErrors` is the numeric error map in Colibri's
`ContractErrorMap` format. The constructor installs it once, scoped to the
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

## Import Colibri conveniences

Generated `colibri.ts` re-exports `NetworkConfig`, `LocalSigner`, `SorobanType`,
`ColibriError`, and common signer, transaction and contract types. These are the
original Core implementations. They are also available from the client
entrypoint unless an ABI declaration uses the same name; ABI names take
precedence. The dedicated module always exposes the conveniences.

This fragment assumes file output for a class named `Token`:

```ts
import { Token } from "./index.ts";
import { LocalSigner, NetworkConfig, type TransactionConfig } from "./colibri.ts";

const signer = LocalSigner.generateRandom();
const client = new Token({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: { contractId: "C..." },
});
const config: TransactionConfig = {
  source: signer.publicKey(),
  fee: "100",
  timeout: 30,
  signers: [signer],
};
```

To use an existing native Stellar SDK Keypair, call
`LocalSigner.fromKeypair(keypair)` and put the returned signer in `config.signers`.
It targets only its own G-address by default. Other accounts or custom contract
authorization require explicit targets and the appropriate authority/encoding.
The factory borrows the keypair; destroying the adapter leaves the original key
unchanged. Public-only keypairs are rejected. Transaction configuration still
accepts Colibri signers, and existing callers need no changes.

New package scaffolds expose the same module at `@example/token/colibri`.
Regeneration preserves existing manifests, so add that subpath manually if
upgrading an older package scaffold. Reexports do not remove Core's runtime
dependency; generated packages declare it for consumers. Applications need a
direct Stellar SDK dependency only when they import and use that SDK themselves.

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
Core `ColibriError` code `CONTR_021`, retaining the successful transaction
result in `meta.data.result` and the original codec failure in `meta.cause`.
Inspect that result and the embedded ABI before deciding the next action;
resubmitting would create another transaction.

## Soroban types and custom declarations

Generated inputs use `SorobanType.Input.Symbol`, `SorobanType.Input.U32` and
related aliases, accepting raw values or optional validated wrappers. Outputs
use `SorobanType.Symbol`, `SorobanType.U32`, etc., and remain ordinary
JavaScript values. The constants/spec/error layout stays unchanged.

Custom types use `SorobanType.Custom` schemas: struct and tuple fields, or enum
variants with explicit tagged/u32 encoding. Colibri derives their input types
and the underlying variant shapes without repeating every field. Structs and
enums have matching spec-backed factories: `Summary.from(fields)` or
`RbacStorage.RoleIndexToAccount(role, index)`. Numeric enums expose their exact
codes and validation on one factory, such as `Status.Active` and
`Status.from(Status.Active)`. All factories provide `.type`, `.fromScVal()` and
`.fromXdr()`. Referenced error types reuse the categorized error map.

A factory argument alias uses `NameValueArgs` if `NameArgs` would collide with a
contract type. Method inputs retain their `MethodInput` names. Use generated
storage-key wrappers with
`client.getLedgerEntry({ key, durability: "persistent" })`; durability and
stored value types remain caller-owned. See
[Soroban types](../docs/core/contract/values.md) for complete examples,
validation and encoding behavior.
