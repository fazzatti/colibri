# core/event/parsing

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                                         | Source                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `EVP_001` | `INVALID_LEDGER_CLOSE_META_XDR` — Raised when ledger-close metadata cannot be decoded as XDR.                     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/parsing/error.ts#L54) |
| `EVP_002` | `UNSUPPORTED_LEDGER_CLOSE_META_VERSION` — Raised when ledger-close metadata uses an unsupported version.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/parsing/error.ts#L55) |
| `EVP_003` | `UNSUPPORTED_TRANSACTION_META_VERSION` — Raised when event parsing encounters transaction metadata other than v4. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/parsing/error.ts#L56) |
