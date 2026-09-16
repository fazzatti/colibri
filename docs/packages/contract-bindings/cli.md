# Generate with the CLI

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
| `--no-colibri`         | Omit `colibri.ts` and its convenience exports; included by default.                 |
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

[Package overview](../contract-bindings.md)
