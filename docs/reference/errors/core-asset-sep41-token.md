# core/asset/sep41-token

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code              | Condition                                                                                                                     | Source                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `SEP41_TOKEN_001` | `MISSING_RETURN_VALUE` — Raised when a standardized read returns no value.                                                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L5)  |
| `SEP41_TOKEN_002` | `FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_FROM` — Raised when the `from` argument for `allowance` cannot be encoded.               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L6)  |
| `SEP41_TOKEN_003` | `FAILED_TO_ENCODE_ALLOWANCE_ARGUMENT_SPENDER` — Raised when the `spender` argument for `allowance` cannot be encoded.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L7)  |
| `SEP41_TOKEN_004` | `FAILED_TO_ENCODE_APPROVE_ARGUMENT_FROM` — Raised when the `from` argument for `approve` cannot be encoded.                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L8)  |
| `SEP41_TOKEN_005` | `FAILED_TO_ENCODE_APPROVE_ARGUMENT_SPENDER` — Raised when the `spender` argument for `approve` cannot be encoded.             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L9)  |
| `SEP41_TOKEN_006` | `FAILED_TO_ENCODE_APPROVE_ARGUMENT_AMOUNT` — Raised when the `amount` argument for `approve` cannot be encoded.               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L10) |
| `SEP41_TOKEN_007` | `FAILED_TO_ENCODE_APPROVE_ARGUMENT_LIVE_UNTIL_LEDGER` — Raised when `liveUntilLedger` for `approve` cannot be encoded.        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L11) |
| `SEP41_TOKEN_008` | `FAILED_TO_ENCODE_BALANCE_ARGUMENT_ID` — Raised when the `id` argument for `balance` cannot be encoded.                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L12) |
| `SEP41_TOKEN_009` | `FAILED_TO_ENCODE_TRANSFER_ARGUMENT_FROM` — Raised when the `from` argument for `transfer` cannot be encoded.                 | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L13) |
| `SEP41_TOKEN_010` | `FAILED_TO_ENCODE_TRANSFER_ARGUMENT_TO` — Raised when the `to` argument for `transfer` cannot be encoded.                     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L14) |
| `SEP41_TOKEN_011` | `FAILED_TO_ENCODE_TRANSFER_ARGUMENT_AMOUNT` — Raised when the `amount` argument for `transfer` cannot be encoded.             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L15) |
| `SEP41_TOKEN_012` | `FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_SPENDER` — Raised when the `spender` argument for `transfer_from` cannot be encoded. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L16) |
| `SEP41_TOKEN_013` | `FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_FROM` — Raised when the `from` argument for `transfer_from` cannot be encoded.       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L17) |
| `SEP41_TOKEN_014` | `FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_TO` — Raised when the `to` argument for `transfer_from` cannot be encoded.           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L18) |
| `SEP41_TOKEN_015` | `FAILED_TO_ENCODE_TRANSFER_FROM_ARGUMENT_AMOUNT` — Raised when the `amount` argument for `transfer_from` cannot be encoded.   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L19) |
| `SEP41_TOKEN_016` | `FAILED_TO_ENCODE_BURN_ARGUMENT_FROM` — Raised when the `from` argument for `burn` cannot be encoded.                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L20) |
| `SEP41_TOKEN_017` | `FAILED_TO_ENCODE_BURN_ARGUMENT_AMOUNT` — Raised when the `amount` argument for `burn` cannot be encoded.                     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L21) |
| `SEP41_TOKEN_018` | `FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_SPENDER` — Raised when the `spender` argument for `burn_from` cannot be encoded.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L22) |
| `SEP41_TOKEN_019` | `FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_FROM` — Raised when the `from` argument for `burn_from` cannot be encoded.               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L23) |
| `SEP41_TOKEN_020` | `FAILED_TO_ENCODE_BURN_FROM_ARGUMENT_AMOUNT` — Raised when the `amount` argument for `burn_from` cannot be encoded.           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sep41-token/error.ts#L24) |
