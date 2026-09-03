# core/processes/sign-envelope

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                                           | Source                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `SEN_000` | `UNEXPECTED_ERROR` — Raised when sign-envelope fails unexpectedly.                                                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L10) |
| `SEN_001` | `NO_REQUIREMENTS` — Raised when signature requirements are missing.                                                 | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L11) |
| `SEN_002` | `NO_SIGNERS` — Raised when no signers are available for signing.                                                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L12) |
| `SEN_003` | `SIGNER_NOT_FOUND` — Raised when the required signer cannot be found among the provided signers.                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L13) |
| `SEN_004` | `FAILED_TO_SIGN_TRANSACTION` — Raised when a signer fails to sign the transaction envelope.                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L14) |
| `SEN_005` | `FAILED_TO_GET_SIGNER_KEY` — Raised when an envelope authorizer cannot expose its exact signer key.                 | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L15) |
| `SEN_006` | `DUPLICATE_SIGNER_KEY` — Raised when more than one supplied signer represents the same signer key.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L16) |
| `SEN_007` | `EXTRA_SIGNER_NOT_FOUND` — Raised when a transaction extra-signer requirement has no exact signer.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L17) |
| `SEN_008` | `UNSUPPORTED_PRE_AUTH_EXTRA_SIGNER` — Raised when a pre-authorized transaction key appears in `extraSigners`.       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L18) |
| `SEN_009` | `AMBIGUOUS_ACCOUNT_SIGNERS` — Raised when multiple distinct signer keys target one required account.                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L19) |
| `SEN_010` | `FAILED_TO_CHECK_SIGNER_TARGET` — Raised when a signer cannot report whether it targets an account.                 | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L20) |
| `SEN_011` | `FAILED_TO_CHECK_PRE_AUTH_TRANSACTION` — Raised when a pre-authorized signer cannot verify the current transaction. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L21) |
| `SEN_012` | `PRE_AUTH_TRANSACTION_MISMATCH` — Raised when a selected pre-authorized signer targets another transaction.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L22) |
| `SEN_013` | `FAILED_TO_READ_EXTRA_SIGNERS` — Raised when transaction extra-signer keys cannot be decoded.                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L23) |
| `SEN_014` | `FAILED_TO_PARSE_SIGNED_TRANSACTION` — Raised when signed envelope XDR cannot be parsed for the next signer.        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-envelope/error.ts#L24) |
