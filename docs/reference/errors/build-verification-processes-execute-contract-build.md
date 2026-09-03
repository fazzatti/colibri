# build-verification/processes/execute-contract-build

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                                | Source                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `BLDV_064` | `WORKSPACE_INITIALIZATION_FAILED` — Raised when the disposable verification workspace cannot be created. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L73) |
| `BLDV_082` | `EXECUTE_BUILD_UNEXPECTED` — Raised when build execution fails outside typed boundary errors.            | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L91) |
| `BLDV_086` | `WORKSPACE_CLEANUP_FAILED` — Raised when an owned build workspace cannot be removed.                     | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L95) |
