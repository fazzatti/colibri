# Bindings demo contract

A small counter for reviewing and testing Colibri's generated clients. Its Wasm
embeds named types, four functions, two documented errors, and the
`CountChanged` event with an indexed `action` topic. This is a test fixture with
no access policy.

From the repository root, generate a client to inspect:

```sh
deno run --allow-read --allow-write contract-bindings/cli.ts \
  --wasm _internal/tests/compiled-contracts/bindings_demo_contract.wasm \
  --class-name Demo --out /tmp/colibri-demo --non-interactive
```

Open `constants.ts`, `types.ts`, `index.ts`, and `README.md` in the output
folder. The checked-in example is in `_internal/tests/generated-bindings/demo/`.

## Maintain the fixture

Use Stellar CLI 26.1.0, Rust 1.96.1, and the pinned Soroban SDK 26.1.1.

```sh
RUSTUP_TOOLCHAIN=1.96.1 cargo test -p bindings-demo-contract
RUSTUP_TOOLCHAIN=1.96.1 deno task build:bindings-fixture
deno task build:bindings-example
```

The fixture builder refreshes the Wasm, extracted spec, and SHA-256 manifest.
After changing the contract or renderer, regenerate and review all three source
files and the README; the generated-output test compares them byte for byte.

```sh
RUSTUP_TOOLCHAIN=1.96.1 deno task check:bindings-fixture
deno task check:bindings-example
deno test -A contract-bindings
```

The package's network integration test uses a local Quickstart ledger to verify
read/invoke behavior, custom errors, and decoding a real emitted event.
