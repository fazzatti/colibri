# core/processes/build-transaction

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                                                     | Source                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `BTX_000` | `UNEXPECTED_ERROR` — Raised when build-transaction fails unexpectedly.                                                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L8)  |
| `BTX_001` | `INVALID_BASE_FEE` — Raised when the provided base fee cannot be parsed.                                                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L9)  |
| `BTX_002` | `BASE_FEE_TOO_LOW` — Raised when the provided base fee is below the supported minimum.                                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L10) |
| `BTX_003` | `COULD_NOT_LOAD_SOURCE_ACCOUNT` — Raised when the source account cannot be loaded.                                            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L11) |
| `BTX_004` | `COULD_NOT_CREATE_TRANSACTION_BUILDER` — Raised when the transaction builder cannot be created.                               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L12) |
| `BTX_005` | `COULD_NOT_SET_SOROBAN_DATA` — Raised when Soroban data cannot be attached to the builder.                                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L13) |
| `BTX_006` | `COULD_NOT_BUILD_TRANSACTION` — Raised when the transaction envelope cannot be built.                                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L14) |
| `BTX_007` | `COULD_NOT_INITIALIZE_ACCOUNT_WITH_SEQUENCE` — Raised when a source account cannot be initialized with the provided sequence. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L15) |
| `BTX_008` | `CONFLICTING_TIME_CONSTRAINTS` — Raised when mutually exclusive time constraints are configured together.                     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L16) |
| `BTX_009` | `FAILED_TO_SET_PRECONDITIONS` — Raised when transaction preconditions cannot be applied to the builder.                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L17) |
| `BTX_010` | `NO_OPERATIONS_PROVIDED` — Raised when no operations are provided to build a transaction.                                     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L18) |
| `BTX_011` | `RPC_REQUIRED_TO_LOAD_ACCOUNT` — Raised when RPC is required to load the source account but missing.                          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L19) |
| `BTX_012` | `INVALID_TRANSACTION_FEE_CONFIGURATION` — Raised when an explicit transaction-fee object does not select one mode.            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L20) |
| `BTX_013` | `INVALID_INCLUSION_FEE` — Raised when an explicit inclusion-fee amount is not an integer string.                              | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L21) |
| `BTX_014` | `INVALID_MAX_FEE` — Raised when an explicit maximum-fee amount is not an integer string.                                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L22) |
| `BTX_015` | `INCLUSION_FEE_TOO_LOW` — Raised when an exact inclusion fee cannot cover every operation.                                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L23) |
| `BTX_016` | `MAX_FEE_TOO_LOW` — Raised when a maximum fee cannot cover resources and minimum inclusion.                                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L24) |
| `BTX_017` | `TRANSACTION_FEE_TOO_HIGH` — Raised when an exact transaction fee exceeds the XDR uint32 limit.                               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/build-transaction/error.ts#L25) |
