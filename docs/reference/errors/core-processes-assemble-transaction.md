# core/processes/assemble-transaction

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                                           | Source                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `ASM_000` | `UNEXPECTED_ERROR` — Raised when assemble-transaction fails unexpectedly.                                           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L9)  |
| `ASM_001` | `MISSING_ARG` — Raised when a required assemble-transaction argument is missing.                                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L11) |
| `ASM_002` | `NOT_SMART_CONTRACT_TRANSACTION` — Raised when the provided transaction does not contain smart-contract operations. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L12) |
| `ASM_003` | `UNSUPPORTED_OPERATION` — Raised when an unsupported operation is encountered during assembly.                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L13) |
| `ASM_004` | `FAILED_TO_ASSEMBLE_TRANSACTION` — Raised when the transaction cannot be assembled from simulation output.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L14) |
| `ASM_005` | `FAILED_TO_BUILD_TRANSACTION` — Raised when the post-assembly transaction build step fails.                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L15) |
| `ASM_006` | `FAILED_TO_BUILD_SOROBAN_DATA` — Raised when Soroban data cannot be rebuilt during assembly.                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L16) |
| `ASM_007` | `INVALID_TRANSACTION_FEE_CONFIGURATION` — Raised when an explicit fee object does not select exactly one mode.      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L17) |
| `ASM_008` | `INVALID_BASE_FEE` — Raised when an explicit base fee is not an integer string.                                     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L18) |
| `ASM_009` | `INVALID_INCLUSION_FEE` — Raised when an explicit inclusion fee is not an integer string.                           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L19) |
| `ASM_010` | `INVALID_MAX_FEE` — Raised when an explicit maximum fee is not an integer string.                                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L20) |
| `ASM_011` | `BASE_FEE_TOO_LOW` — Raised when an explicit base fee is not positive.                                              | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L21) |
| `ASM_012` | `INCLUSION_FEE_TOO_LOW` — Raised when an explicit inclusion fee is below the network minimum.                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L22) |
| `ASM_013` | `MAX_FEE_TOO_LOW` — Raised when a maximum fee cannot cover resources and minimum inclusion.                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L23) |
| `ASM_014` | `TRANSACTION_FEE_TOO_HIGH` — Raised when the assembled total exceeds the XDR uint32 limit.                          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L24) |
| `ASM_015` | `TRANSACTION_FEE_BELOW_RESOURCE_FEE` — Raised when the input transaction fee is lower than its embedded resources.  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L25) |
| `ASM_016` | `INVALID_RESOURCE_FEE` — Raised when an explicit resource-fee override is not an integer string.                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L26) |
| `ASM_017` | `RESOURCE_FEE_BELOW_SIMULATED_MINIMUM` — Raised when an override is below the simulation-derived resource fee.      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-transaction/error.ts#L27) |
