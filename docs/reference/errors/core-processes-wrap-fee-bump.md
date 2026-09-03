# core/processes/wrap-fee-bump

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                      | Source                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `WFB_000` | `UNEXPECTED_ERROR` — Raised when wrapping a fee bump fails unexpectedly.                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/wrap-fee-bump/error.ts#L8)  |
| `WFB_001` | `MISSING_ARG` — Raised when a required wrap-fee-bump input field is missing.                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/wrap-fee-bump/error.ts#L10) |
| `WFB_002` | `ALREADY_FEE_BUMP` — Raised when the input transaction is already a fee-bump envelope.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/wrap-fee-bump/error.ts#L11) |
| `WFB_003` | `NOT_A_TRANSACTION` — Raised when the provided transaction is not a valid Stellar transaction. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/wrap-fee-bump/error.ts#L13) |
| `WFB_004` | `FAILED_TO_BUILD_FEE_BUMP` — Raised when the fee-bump envelope cannot be built.                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/wrap-fee-bump/error.ts#L14) |
| `WFB_005` | `FEE_TOO_LOW` — Raised when the provided fee-bump fee is too low.                              | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/wrap-fee-bump/error.ts#L16) |
