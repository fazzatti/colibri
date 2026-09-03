# build-verification/error/core

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                             | Source                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `BLDV_000` | `INVALID_VERIFIER_OPTIONS` — Raised when mutually exclusive or invalid verifier options are supplied. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L10)  |
| `BLDV_003` | `INVALID_TARGET_WASM` — Raised when target bytes are not a valid WebAssembly module.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L13)  |
| `BLDV_004` | `METADATA_DECODING_FAILED` — Raised when a `contractmetav0` section contains malformed XDR.           | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L14)  |
| `BLDV_005` | `DUPLICATE_SEP58_METADATA` — Raised when a scalar SEP-58 metadata key appears more than once.         | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L15)  |
| `BLDV_006` | `INVALID_SEP58_METADATA` — Raised when authoritative or out-of-band build metadata is invalid.        | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L16)  |
| `BLDV_007` | `MISSING_OUT_OF_BAND_RECIPE` — Raised when out-of-band mode has no explicit recipe.                   | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L17)  |
| `BLDV_093` | `INVALID_VERIFICATION_INPUT` — Raised when a runtime request violates the public discriminated union. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L102) |
