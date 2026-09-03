# core/signer/hash-x

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code          | Condition                                                                                                | Source                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `SIG_HSX_001` | `INVALID_PREIMAGE_LENGTH` — Raised when a Hash-X preimage exceeds Stellar's 64-byte signature limit.     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/hash-x/error.ts#L6)  |
| `SIG_HSX_002` | `PREIMAGE_NOT_ACCESSIBLE` — Raised when direct preimage access was disabled.                             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/hash-x/error.ts#L7)  |
| `SIG_HSX_003` | `SIGNER_DESTROYED` — Raised when a destroyed Hash-X signer is used.                                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/hash-x/error.ts#L8)  |
| `SIG_HSX_004` | `FAILED_TO_GENERATE_PREIMAGE` — Raised when secure random preimage generation fails.                     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/hash-x/error.ts#L9)  |
| `SIG_HSX_005` | `FAILED_TO_DERIVE_HASH` — Raised when the SDK cannot hash the configured preimage.                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/hash-x/error.ts#L10) |
| `SIG_HSX_006` | `FAILED_TO_ENCODE_SIGNER_KEY` — Raised when the Hash-X digest cannot be encoded as an `X...` signer key. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/hash-x/error.ts#L11) |
| `SIG_HSX_007` | `FAILED_TO_ADD_PREIMAGE_SIGNATURE` — Raised when the SDK cannot append the preimage signature.           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/hash-x/error.ts#L12) |
| `SIG_HSX_008` | `FAILED_TO_SERIALIZE_TRANSACTION` — Raised when the Hash-X-authorized transaction cannot be serialized.  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/hash-x/error.ts#L13) |
| `SIG_HSX_009` | `FAILED_TO_NORMALIZE_PREIMAGE` — Raised when supplied preimage bytes cannot be normalized.               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/hash-x/error.ts#L14) |
