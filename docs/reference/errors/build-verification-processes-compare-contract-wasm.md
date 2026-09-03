# build-verification/processes/compare-contract-wasm

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                             | Source                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `BLDV_084` | `COMPARE_WASM_UNEXPECTED` — Raised when raw byte comparison fails outside its deterministic contract. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L93) |
