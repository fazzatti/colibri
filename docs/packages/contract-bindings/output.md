# Output packages and Core conveniences

## Use files, JSR, or npm

`--output files` emits `constants.ts` (method names, spec, errors), `types.ts`
(named inputs/outputs and mapped types), `index.ts` (the client and exports),
`colibri.ts` (Core conveniences), and a formatted `README.md` for an existing
project. Configure imports in that project: both presets import only
`@colibri/core`; Core supplies the Stellar SDK dependency and spec codec.

The generated `types.ts` is organized into labeled sections: methods and their
inputs/outputs/maps, contract-declared types when present, events, and client
configuration. Error maps use Core's `ContractErrorMap` type.

`--output package --target jsr` places the generated source files in
`generated/`, with a `mod.ts` entrypoint and a `deno.json`. Run
`deno task check` in the output directory. `--target npm` creates a
`package.json`, TypeScript build configuration, `.npmrc`, and ESM exports. Run
`npm install` and `npm run build`; JavaScript and declarations appear in
`dist/`. The SDK requires Node 22.12 or newer. The npm package shares Core
through an alias of `@jsr/colibri__core`, using `https://npm.jsr.io` for the
`@jsr` scope. Carry that registry configuration into consuming projects and CI.

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
and its declarations. Both expose the Core conveniences through `/colibri`
unless `--no-colibri` is set.

## Import Colibri conveniences

Generated `colibri.ts` re-exports `NetworkConfig`, `LocalSigner`, `SorobanType`,
`ColibriError`, and common signer, transaction and contract types. These are the
original Core implementations. They are also available from the client
entrypoint unless an ABI declaration uses the same name; ABI names take
precedence. When enabled, the dedicated module always exposes the conveniences.

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

### Omit convenience exports

Use `--no-colibri` when your application already imports Core directly or owns a
shared Colibri entrypoint for several generated clients:

```sh
deno run --allow-read --allow-write jsr:@colibri/contract-bindings/cli \
  --wasm ./contract.wasm --class-name Token --output files \
  --out ./token-client --no-colibri --non-interactive
```

The API option is `includeColibri: false`; its default is `true`. It applies to
both output modes and both registry presets:

- The output plan omits `colibri.ts` (or `generated/colibri.ts` for packages).
- `index.ts` exports the contract's generated API without the convenience
  re-exports. Contract types, constants, events and client behavior are
  unchanged.
- New package manifests omit the `/colibri` subpath.
- The generated README imports helpers directly from `@colibri/core`.

Core remains a runtime dependency. For example, the imports for the generated
client fragment above become:

```ts
import { Token } from "./token-client/index.ts";
import {
  LocalSigner,
  NetworkConfig,
  type TransactionConfig,
} from "@colibri/core";
```

When switching an existing directory, update application imports, remove its old
convenience file and `/colibri` manifest export, and update the existing README
(or remove it explicitly to generate a new one). `--force` does not delete files
outside the new plan or rewrite existing package scaffolds. Keep `--no-colibri`
on subsequent CLI runs, or `includeColibri: false` in your generation script;
omitting the option enables conveniences again.

[Package overview](../contract-bindings.md)
