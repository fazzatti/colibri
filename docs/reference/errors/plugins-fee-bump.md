# plugins/fee-bump

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code          | Condition                                                                        | Source                                                                                        |
| ------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `PLG_FBP_000` | `UNEXPECTED_ERROR` — Raised when fee-bump plugin creation fails unexpectedly.    | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/fee-bump/src/error.ts#L9)  |
| `PLG_FBP_001` | `MISSING_ARG` — Raised when a required plugin argument is missing.               | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/fee-bump/src/error.ts#L10) |
| `PLG_FBP_002` | `NOT_A_TRANSACTION` — Raised when the plugin receives a non-transaction payload. | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/fee-bump/src/error.ts#L11) |
