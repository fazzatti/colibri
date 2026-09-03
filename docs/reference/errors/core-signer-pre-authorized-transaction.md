# core/signer/pre-authorized-transaction

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code          | Condition                                                                                                     | Source                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `SIG_PAT_001` | `INVALID_TRANSACTION_HASH_LENGTH` — Raised when a supplied transaction hash is not 32 bytes.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/pre-authorized-transaction/error.ts#L6)  |
| `SIG_PAT_002` | `FAILED_TO_HASH_TRANSACTION_DURING_CREATION` — Raised when the factory cannot hash a prepared transaction.    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/pre-authorized-transaction/error.ts#L7)  |
| `SIG_PAT_003` | `FAILED_TO_DECODE_SIGNER_KEY` — Raised when a supplied `T...` key cannot be decoded.                          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/pre-authorized-transaction/error.ts#L8)  |
| `SIG_PAT_004` | `FAILED_TO_ENCODE_SIGNER_KEY` — Raised when raw transaction-hash bytes cannot be encoded as a `T...` key.     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/pre-authorized-transaction/error.ts#L9)  |
| `SIG_PAT_005` | `FAILED_TO_HASH_TRANSACTION_DURING_AUTHORIZATION` — Raised when authorization-time transaction hashing fails. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/pre-authorized-transaction/error.ts#L10) |
| `SIG_PAT_006` | `FAILED_TO_NORMALIZE_TRANSACTION_HASH` — Raised when raw transaction-hash bytes cannot be normalized.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/pre-authorized-transaction/error.ts#L11) |
