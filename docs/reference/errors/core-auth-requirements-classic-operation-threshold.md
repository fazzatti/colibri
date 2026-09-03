# core/auth/requirements/classic-operation-threshold

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code           | Condition                                                                                                       | Source                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_COT_000` | `UNEXPECTED_ERROR` — Raised when an unexpected error occurs during threshold evaluation.                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/auth/requirements/classic-operation-threshold/error.ts#L6) |
| `AUTH_COT_001` | `FAILED_TO_IDENTIFY_SIGNER_FROM_SOURCE` — Raised when the source account cannot be resolved to a signer target. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/auth/requirements/classic-operation-threshold/error.ts#L7) |
