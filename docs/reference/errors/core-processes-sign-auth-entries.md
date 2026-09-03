# core/processes/sign-auth-entries

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                            | Source                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `SAE_000` | `UNEXPECTED_ERROR` — Raised when sign-auth-entries fails unexpectedly.                               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-auth-entries/error.ts#L9)  |
| `SAE_001` | `MISSING_ARG` — Raised when a required sign-auth-entries input field is missing.                     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-auth-entries/error.ts#L10) |
| `SAE_002` | `VALID_UNTIL_LEDGER_SEQ_TOO_LOW` — Raised when `validUntilLedgerSeq` is below the supported minimum. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-auth-entries/error.ts#L11) |
| `SAE_003` | `VALID_FOR_LEDGERS_TOO_LOW` — Raised when `validForLedgers` is below the supported minimum.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-auth-entries/error.ts#L12) |
| `SAE_004` | `VALID_FOR_SECONDS_TOO_LOW` — Raised when `validForSeconds` is below the supported minimum.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-auth-entries/error.ts#L13) |
| `SAE_005` | `FAILED_TO_FETCH_LATEST_LEDGER` — Raised when the latest ledger cannot be fetched from RPC.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-auth-entries/error.ts#L14) |
| `SAE_006` | `MISSING_SIGNER` — Raised when the required signer for an auth entry cannot be found.                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-auth-entries/error.ts#L15) |
| `SAE_007` | `FAILED_TO_SIGN_AUTH_ENTRY` — Raised when signing an authorization entry fails.                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/sign-auth-entries/error.ts#L16) |
