# build-verification/artifacts

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                         | Source                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `BLDV_027` | `BUILD_ARTIFACT_NOT_FOUND` — Raised when a successful build produces no eligible Wasm.            | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L37) |
| `BLDV_028` | `BUILD_ARTIFACT_AMBIGUOUS` — Raised when artifact selection would require guessing.               | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L38) |
| `BLDV_029` | `BUILD_ARTIFACT_READ_FAILED` — Raised when one candidate Wasm cannot be read.                     | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L39) |
| `BLDV_035` | `BUILD_ARTIFACT_SNAPSHOT_FAILED` — Compatibility error for pre-build artifact inventory failures. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L44) |
| `BLDV_066` | `ARTIFACT_LIMIT_EXCEEDED` — Raised when a candidate exceeds the configured artifact byte limit.   | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L75) |
| `BLDV_067` | `UNSAFE_ARTIFACT_PATH` — Raised when a candidate path is outside the supported release layout.    | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L76) |
| `BLDV_087` | `ARTIFACT_COLLECTION_FAILED` — Raised when candidate traversal fails before cleanup.              | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L96) |
