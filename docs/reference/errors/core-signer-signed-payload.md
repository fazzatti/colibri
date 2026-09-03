# core/signer/signed-payload

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code          | Condition                                                                                                       | Source                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `SIG_SPL_001` | `INVALID_PAYLOAD_LENGTH` — Raised when a payload is empty or exceeds the protocol limit.                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/signed-payload/error.ts#L6)  |
| `SIG_SPL_002` | `FAILED_TO_GET_PUBLIC_KEY` — Raised when the underlying Ed25519 signer cannot expose its public key.            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/signed-payload/error.ts#L7)  |
| `SIG_SPL_003` | `FAILED_TO_DECODE_PUBLIC_KEY` — Raised when the configured Ed25519 public key cannot be decoded.                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/signed-payload/error.ts#L8)  |
| `SIG_SPL_004` | `FAILED_TO_HASH_TRANSACTION` — Raised when a transaction hash cannot be derived for a payload.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/signed-payload/error.ts#L9)  |
| `SIG_SPL_005` | `FAILED_TO_SIGN_PAYLOAD` — Raised when the underlying Ed25519 signer cannot sign the payload.                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/signed-payload/error.ts#L10) |
| `SIG_SPL_006` | `FAILED_TO_BUILD_DECORATED_SIGNATURE` — Raised when the signed-payload signature cannot be decorated.           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/signed-payload/error.ts#L11) |
| `SIG_SPL_007` | `FAILED_TO_ADD_DECORATED_SIGNATURE` — Raised when the decorated signature cannot be added to the envelope.      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/signed-payload/error.ts#L12) |
| `SIG_SPL_008` | `FAILED_TO_SERIALIZE_TRANSACTION` — Raised when the signed-payload-authorized transaction cannot be serialized. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/signed-payload/error.ts#L13) |
| `SIG_SPL_009` | `FAILED_TO_NORMALIZE_PAYLOAD` — Raised when supplied payload bytes cannot be normalized.                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/signed-payload/error.ts#L14) |
| `SIG_SPL_010` | `FAILED_TO_BUILD_SIGNER_KEY_XDR` — Raised when the signed-payload signer-key XDR cannot be built.               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/signed-payload/error.ts#L15) |
| `SIG_SPL_011` | `FAILED_TO_ENCODE_SIGNER_KEY` — Raised when signed-payload signer-key XDR cannot be encoded as `P...`.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/signed-payload/error.ts#L16) |
| `SIG_SPL_012` | `FAILED_TO_NORMALIZE_SIGNATURE` — Raised when returned signature bytes cannot be normalized.                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/signed-payload/error.ts#L17) |
