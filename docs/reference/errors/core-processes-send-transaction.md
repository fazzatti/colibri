# core/processes/send-transaction

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                     | Source                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `STX_000` | `UNEXPECTED_ERROR` — Raised when send-transaction fails unexpectedly.                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/send-transaction/error.ts#L13) |
| `STX_001` | `MISSING_ARG` — Raised when a required send-transaction input field is missing.               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/send-transaction/error.ts#L14) |
| `STX_002` | `FAIL_TO_SEND_TRANSACTION` — Raised when the transaction cannot be submitted to RPC.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/send-transaction/error.ts#L15) |
| `STX_003` | `TIMEOUT_TOO_LOW` — Raised when the polling timeout is below the supported minimum.           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/send-transaction/error.ts#L16) |
| `STX_004` | `WAIT_INTERVAL_TOO_LOW` — Raised when the polling interval is below the supported minimum.    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/send-transaction/error.ts#L17) |
| `STX_005` | `DUPLICATE_TRANSACTION` — Raised when the submitted transaction is a duplicate.               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/send-transaction/error.ts#L18) |
| `STX_006` | `TRY_AGAIN_LATER` — Raised when the network asks the caller to retry later.                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/send-transaction/error.ts#L19) |
| `STX_007` | `ERROR_STATUS` — Raised when RPC returns the `ERROR` transaction status.                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/send-transaction/error.ts#L20) |
| `STX_008` | `UNEXPECTED_STATUS` — Raised when RPC returns an unsupported transaction status.              | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/send-transaction/error.ts#L21) |
| `STX_009` | `FAILED_TO_GET_TRANSACTION_STATUS` — Raised when polling transaction status fails.            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/send-transaction/error.ts#L22) |
| `STX_010` | `TRANSACTION_FAILED` — Raised when a submitted transaction reaches the failed terminal state. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/send-transaction/error.ts#L23) |
| `STX_011` | `TRANSACTION_NOT_FOUND` — Raised when a transaction hash cannot be found on the network.      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/send-transaction/error.ts#L24) |
