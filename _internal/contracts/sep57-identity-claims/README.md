# SEP-57 Identity Claims ABI fixture

This repository-only fixture checks the specification emitted by Rust's
`#[contracttype]` and `#[contractimpl]` macros. It is not a functional identity
contract and must not be deployed as one. It is not included in JSR packages.

`Claim` deliberately follows the SEP's declaration order in Rust. The compiled
specification has alphabetically ordered named fields. Colibri's regression test
reads that compiled Wasm using the native Stellar `Spec` class.

From the repository root, rebuild with the locked workspace dependencies:

```sh
cargo build --locked --release --target wasm32v1-none -p sep57-identity-claims-contract
cp target/wasm32v1-none/release/sep57_identity_claims_contract.wasm _internal/tests/compiled-contracts/
deno test -A core/contract/interface/sep57-rust.unit.test.ts
```
