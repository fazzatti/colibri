# core/processes/envelope-signing-requirements

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                                                     | Source                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ESR_000` | `UNEXPECTED_ERROR` — Raised when envelope-signing-requirements fails unexpectedly.                                            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/envelope-signing-requirements/error.ts#L8)  |
| `ESR_001` | `INVALID_TRANSACTION_TYPE` — Raised when the provided transaction type is unsupported.                                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/envelope-signing-requirements/error.ts#L10) |
| `ESR_002` | `FAILED_TO_PROCESS_REQUIREMENTS_FOR_FEE_BUMP_TX` — Raised when fee-bump signing requirements cannot be processed.             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/envelope-signing-requirements/error.ts#L12) |
| `ESR_003` | `FAILED_TO_PROCESS_REQUIREMENTS_FOR_TRANSACTION` — Raised when standard transaction signing requirements cannot be processed. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/envelope-signing-requirements/error.ts#L13) |
