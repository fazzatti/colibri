# Generate a Colibri contract client

`@colibri/contract-bindings` turns a Soroban contract spec into a `Contract`
subclass with typed per-method `.read()` and `.invoke()` helpers, embedded spec
entries, a Colibri error map, and typed event definitions. Its initial 0.1
release requires Core 1.1. The CLI runs on Deno; the renderer and generated
clients can be used from supported Deno, Node or browser projects. See the
[runtime compatibility policy](../getting-started/compatibility.md) and the
[package API reference](https://jsr.io/@colibri/contract-bindings/doc).

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
missing required flags are errors. Invalid supplied flags fail before the wizard
or source loading. Each prompt validates its answer before advancing and lets
you correct it in place. Contract IDs include checksum validation; WASM hashes
must contain 64 hexadecimal characters. File/directory paths, RPC URL syntax and
HTTP opt-in, nonblank passphrases, and class/package names are checked locally.
These checks do not establish network reachability or on-chain contract
existence. **Ctrl+C** or **Ctrl+D** cancels a prompt without writing output
files.

There is no class-name question: local `my_token.wasm` becomes `MyToken`.
Soroban specs have no contract-name field, so remote sources use
`ContractClient`, as do filenames that cannot form a valid client name. Use
`--class-name Token` to override the default. Overrides must be valid TypeScript
class identifiers without collisions with generated imports or globals such as
`ContractId`, `Object`, and `Promise`. Invalid overrides fail before source
loading; unusable filename defaults fall back to `ContractClient`.

Provenance is omitted by default. Add `--include-provenance` to emit a
`TokenProvenance` constant (when the class is `Token`) containing available
source identity and RPC observations. In the programmatic API, passing
`provenance: loaded.provenance` explicitly enables the same output.

## CLI options

Use `--name value` or `--name=value` for value flags. Switches take no value.
Unknown flags, duplicate flags and multiple sources are rejected. Without
`--non-interactive`, a terminal asks for missing values; nonterminal execution
uses the defaults below and fails if a required value is absent.

| Flag                   | Accepted value or default                                                           |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `--wasm`               | Local Wasm path; choose exactly one source.                                         |
| `--contract-id`        | Checksummed C-address; requires a network.                                          |
| `--wasm-hash`          | 64 hexadecimal characters; requires a network.                                      |
| `--network`            | `mainnet`, `testnet`, `futurenet`, or `custom`; required for network sources.       |
| `--rpc-url`            | Override a preset RPC URL; required for `custom`.                                   |
| `--network-passphrase` | Required for `custom`; cannot override a named network.                             |
| `--allow-http`         | Permit an HTTP RPC URL; off by default.                                             |
| `--output`             | `files` (default) or `package`.                                                     |
| `--target`             | `jsr` (default) or `npm`; selects imports and package scaffolding.                  |
| `--out`                | Destination directory; defaults to `./bindings`.                                    |
| `--class-name`         | Explicit class name; otherwise derived from the local filename or `ContractClient`. |
| `--package-name`       | Required for package output; JSR names must be scoped.                              |
| `--include-provenance` | Emit source identity; off by default.                                               |
| `--force`              | Replace existing generator-owned files; off by default.                             |
| `--non-interactive`    | Disable prompts; off by default.                                                    |
| `--help`               | Print usage without generating files.                                               |

For example, use an existing Wasm hash on a custom network with file output. Set
`WASM_HASH`, `RPC_URL` and `NETWORK_PASSPHRASE` to your application's values:

```sh
deno run --allow-read --allow-write --allow-net jsr:@colibri/contract-bindings/cli \
  --wasm-hash "$WASM_HASH" --network custom \
  --rpc-url "$RPC_URL" --network-passphrase "$NETWORK_PASSPHRASE" \
  --output files --target jsr --out ./bindings --non-interactive
```

The CLI exits with status `1` on failure or `130` on prompt cancellation.
Read/write permissions cover local input and output. `--allow-net` is needed for
network sources; `--allow-http` is a separate application-level opt-in and does
not grant Deno network permission.

## Use files, JSR, or npm

`--output files` emits `constants.ts` (method names, spec, errors), `types.ts`
(named inputs/outputs and mapped types), `index.ts` (the client and exports),
`colibri.ts` (Core conveniences), and a formatted `README.md` for an existing
project. Configure imports in that project: both presets import only
`@colibri/core`; Core supplies the Stellar SDK dependency and spec codec.

The generated `types.ts` is organized into labeled sections: methods and their
inputs/outputs/maps, contract-declared types when present, events, and client
configuration. Error maps use Core's `ContractErrorMap` type.

`--output package --target jsr` places the four source files in `generated/`,
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
Resolve the failure and rerun. The writer preflights paths and conflicts before
writing and rejects symbolic links in the destination. It will not replace an
unmarked handwritten file even with `--force`.

For file output, install Core in the host project
(`deno add jsr:@colibri/core@^1.1.0` or `npx jsr add @colibri/core@^1.1.0`). For
packages, run the following inside the generated directory:

```sh
# JSR package: check the TypeScript exports.
deno task check

# npm package: install dependencies and build ESM plus declarations.
npm install
npm run build
```

Choose the commands for your target; the generator does not run them. JSR
exports source TypeScript through `mod.ts`; npm exports compiled `dist/mod.js`
and its declarations. Both expose the Core conveniences through `/colibri`.

## Import Colibri conveniences

Generated `colibri.ts` re-exports `NetworkConfig`, `LocalSigner`, `SorobanType`,
`ColibriError`, and common signer, transaction and contract types. These are the
original Core implementations. They are also available from the client
entrypoint unless an ABI declaration uses the same name; ABI names take
precedence. The dedicated module always exposes the conveniences.

This fragment assumes file output for a class named `Token`:

```ts
import { Token } from "./index.ts";
import {
  LocalSigner,
  NetworkConfig,
  type TransactionConfig,
} from "./colibri.ts";

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
`LocalSigner.fromKeypair(keypair)` and put the returned signer in
`config.signers`. It targets only its own G-address by default. Other accounts
or custom contract authorization require explicit targets and the appropriate
authority/encoding. The factory borrows the keypair; destroying the adapter
leaves the original key unchanged. Public-only keypairs are rejected.
Transaction configuration still accepts Colibri signers, and existing callers
need no changes.

New package scaffolds expose the same module at `@example/token/colibri`.
Regeneration preserves existing manifests, so add that subpath manually if
upgrading an older package scaffold. Reexports do not remove Core's runtime
dependency; generated packages declare it for consumers. Applications need a
direct Stellar SDK dependency only when they import and use that SDK themselves.

## Understand the generated types

Every callable ABI method has a property with **both** `.read()` and
`.invoke()`. The ABI does not say which functions write state; choose simulation
with `.read()`, or transaction submission through Core's pipeline with
`.invoke()`.

This fragment assumes your generated `Token` class declares `balance` and
`transfer`, and that the addresses and transaction configuration are supplied by
your application:

```ts
const balance = await token.balance.read({ account: address });
const result = await token.transfer.invoke({
  methodArgs: { from: address, to: recipient, amount: 100n },
  config: transactionConfig,
});
console.log(balance, result.value, result.hash);
```

Reads accept the method's argument object directly. Invocations take one object
with `methodArgs`, `config`, and optional `auth`, just like generic `invoke`
without `method`. Argument-free functions use `.read()` and can omit
`methodArgs` from `.invoke({ config })`. Helpers remain bound to their client
when destructured. They delegate to the existing generic `client.read()` and
`client.invoke()` methods, which remain available with their existing call
shape.

Property names use camelCase: `grant_role` becomes `client.grantRole`, and
`get_URL` becomes `client.getUrl`. Names that collide after casing or with a
client member or JavaScript hook receive a `Method` suffix until unused. For
example, an ABI function `read` is exposed as `client.readMethod.read()`.
Normalized collisions are resolved in spec order. Warnings report collisions;
ordinary casing changes are expected. The generated README's function table
shows every mapping. Generic method keys, argument fields, and the ABI method
names sent to Core stay unchanged.

Soroban runs `__constructor` during deployment, so generated clients omit it
from convenience properties, `ContractMethods`, and their callable method maps.
The embedded spec retains its declaration, and `ConstructorInput` describes its
deployment arguments. This is separate from the JavaScript client constructor's
configuration type. The generated class keeps its normal JavaScript constructor.

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
method map. Custom declarations have separate factory argument aliases,
described under [validated contract values](#validated-contract-values).
Repeated original names use the first SDK declaration with a warning. Casing
collisions fail explicitly instead of introducing numerical type prefixes.

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
Spread the original entry when customizing a message to retain its metadata. For
example, this fragment assumes your generated `TokenErrors` declares code `7`
and your application supplies `networkConfig` and `contractId`:

```ts
import { Token, TokenErrors } from "./token-client/index.ts";

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

Prepare the map before constructing the client; there is no additional mutable
error-installation method. Matched errors surface `name` and `category` in
`error.meta.data.match`. Core's spec/WASM helpers and
`Contract.loadContractErrorsFromWasm()` preserve these fields too; manually
supplied maps may omit them.

`token.events.Transfer` is a Core event definition when that name is declared in
the ABI. Its `toTopicFilter` and `toEventFilter` accept only indexed fields.
`fromEvent` validates exact topic count and types and single-value, vector, or
map payloads. The resulting `ContractEvent` retains the original ledger,
transaction, and raw-XDR information alongside typed `fields` and `get()`.

For a declared `Transfer` event with an indexed `from` field and an `amount`
payload field, use the definition directly. Here `event` is an
application-supplied Colibri event returned by its event APIs, and `address` is
the sender to filter:

```ts
const definition = token.events.Transfer;
const filter = definition.toEventFilter({ from: address });
const transfer = definition.fromEvent(event);
console.log(filter, transfer.fields.amount, transfer.ledger, transfer.txHash);
```

Unindexed payload fields cannot be used as topic filters. Event names, fields,
indexed flags and documentation come from the spec; the generator does not infer
them from historical transactions.

`tryFromEvent` returns undefined on a nonmatch. Registry `parse` throws if more
than one declaration matches; select the name and occurrence explicitly.
`events.bindings` records aliases for collisions with registry properties.
Contracts may emit events even when the spec contains no event declarations.

Core also supports dynamic event extraction without generating files. See
[spec-aware events](../core/contract/events.md).

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
  provenance: loaded.provenance,
});
const result = await writeBindings(plan, { directory: "./token-client" });
console.log(result.written, plan.warnings);
```

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
`packageName`. The return value separates:

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

## Failures and ABI changes

The embedded ABI is a snapshot. Regenerate after a contract upgrade. Loading a
different spec into the typed class invalidates its type guarantees. Provenance
contains code hashes and separate RPC ledger observations, not an atomic network
snapshot or endpoint credentials.

Inspect `error.code` on a caught `BindingError` for stable
CLI/source/rendering/output failures and its cause for the Core or filesystem
error. The [error catalog](../reference/errors/contract-bindings.md) lists every
code. The CLI exits unsuccessfully on failure. See the
[full API](https://jsr.io/@colibri/contract-bindings/doc) and
[CLI API](https://jsr.io/@colibri/contract-bindings/doc/cli).

If invoke succeeds but decoding its result fails, the generated client throws
Core `ColibriError` code `CONTR_021`, retaining the successful transaction
result in `meta.data.result` and the original codec failure in `meta.cause`.
Inspect that result and the embedded ABI before deciding the next action;
resubmitting would create another transaction.

## Validated contract values

Newly generated inputs accept raw values and
[validated Soroban helpers](../core/contract/values.md). Output aliases such as
`SorobanType.U32` retain plain result shapes. Custom types use
`SorobanType.Custom` schemas, with struct/tuple fields or tagged/u32 enum
variants. Matching factories reuse the embedded spec. Numeric codes and
validation live on one factory. Each custom declaration has a `NameArgs` alias
for the values accepted by its factory, while method arguments retain their
`MethodInput` names. Method input fields reuse the custom `NameArgs` aliases. If
`NameArgs` collides with a contract type, the factory alias uses
`NameValueArgs`.

For example, if your spec declares a `TtlConfig` struct with `threshold` and
`extend_to` U32 fields, the generated declarations can be used like this:

```ts
import { TtlConfig, type TtlConfigArgs } from "./token-client/types.ts";
import { SorobanType } from "./token-client/colibri.ts";

const args: TtlConfigArgs = {
  threshold: 100,
  extend_to: SorobanType.U32.from(1_000),
};
const config = TtlConfig.from(args);
const encoded = config.toScVal();
const restored: TtlConfig = TtlConfig.fromScVal(encoded).value;
console.log(restored.threshold);
```

The type and runtime factory deliberately share the name `TtlConfig`: type
annotations describe decoded fields, while `.from()` validates construction
arguments. `TtlConfigArgs` describes those arguments, not a contract method's
parameters. Factories also expose `.type` and `.fromXdr()`; validated instances
expose `.value`, `.toScVal()` and `.toXdr()`.

Tagged enums offer variant constructors, such as
`RbacStorage.RoleIndexToAccount("ADMIN", 0)` for a matching spec declaration.
Numeric enum factories preserve their declared codes, such as `Status.Active`,
and validate them through `Status.from(Status.Active)`. Tuple fields and enum
payload positions retain their declared order; only map keys are canonically
sorted during encoding. See the
[Soroban value guide](../core/contract/values.md) for complete struct, tuple,
enum and container examples.

A generated storage-key value can be passed to
`client.getLedgerEntry({ key, durability: "persistent" })`. Supply the correct
durability and interpret the returned storage value yourself: a key type in the
spec does not describe the contract's complete storage layout.
