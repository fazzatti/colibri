# Contract Bindings

`@colibri/contract-bindings` turns a Soroban contract spec into a `Contract`
subclass with typed per-method `.read()` and `.invoke()` helpers, embedded spec
entries, a Colibri error map, and typed event definitions. Generated clients
require Core 1.1 or a compatible 1.x release. The CLI runs on Deno; the renderer
and generated clients can be used from supported Deno, Node or browser projects.
See the [runtime compatibility policy](../getting-started/compatibility.md) and
the [package API reference](https://jsr.io/@colibri/contract-bindings/doc).

## Choose a source and output

Start with a Wasm file, a Wasm hash, or a deployed contract ID. The
[CLI guide](contract-bindings/cli.md#choose-a-source-and-output) walks through
the interactive wizard and explicit commands.

## CLI options

Use [CLI options](contract-bindings/cli.md#cli-options) to select the source,
network, output format and generated client name without interactive prompts.

## Use files, JSR, or npm

Generate files for an existing application or a standalone package with a JSR or
npm preset. See
[output packages](contract-bindings/output.md#use-files-jsr-or-npm) for the
emitted files, dependencies and regeneration rules.

## Import Colibri conveniences

Generated clients include a `colibri.ts` convenience module by default. See
[Core conveniences](contract-bindings/output.md#import-colibri-conveniences) for
its exports and usage.

### Omit convenience exports

Pass `--no-colibri` or `includeColibri: false` to omit that module and its
re-exports. The
[opt-out guide](contract-bindings/output.md#omit-convenience-exports) also
covers regeneration of an existing output directory.

## Understand the generated types

Each generated method has `.read()` and `.invoke()` helpers. Learn their
[arguments, results and ABI mappings](contract-bindings/generated-client.md#understand-the-generated-types)
before choosing simulation or submission.

## Assemble errors and use events

Use generated error definitions to customize messages and typed event templates
to decode contract events. See
[errors and events](contract-bindings/errors-and-events.md).

## Generate programmatically

Compose source loading, rendering and filesystem output in your own script. The
[programmatic guide](contract-bindings/programmatic.md) starts with a complete
Wasm-to-JSR example.

### Source variants

Choose between the portable renderer and Deno source-loading helpers in
[source variants](contract-bindings/programmatic.md#source-variants).

### Rendering and writing

Keep rendering separate from filesystem writes. See
[rendering and writing](contract-bindings/programmatic.md#rendering-and-writing)
for returned artifacts and overwrite behavior.

### Public exports and custom prompts

Embed the CLI with an application-owned prompt adapter. See
[exports and custom prompts](contract-bindings/programmatic.md#public-exports-and-custom-prompts)
for the portable and Deno-only entrypoints.

## Failures and ABI changes

Regenerate when the ABI changes and inspect typed errors before retrying a
failed call. The [failure guide](contract-bindings/troubleshooting.md) covers
generation errors, runtime errors and post-submission decode failures.

## Validated contract values

Generated codecs validate contract values at runtime as well as exposing
TypeScript types. See
[validated values](contract-bindings/generated-client.md#validated-contract-values)
for custom structs, enums and storage keys.
