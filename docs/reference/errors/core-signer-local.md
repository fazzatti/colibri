# core/signer/local

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code          | Condition                                                                                       | Source                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `SIG_LOC_001` | `CANNOT_REMOVE_MASTER_TARGET` — The signer's own account cannot be removed from its targets.    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/local/error.ts#L5)  |
| `SIG_LOC_002` | `SECRET_NOT_ACCESSIBLE` — Secret access was explicitly disabled for this signer.                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/local/error.ts#L6)  |
| `SIG_LOC_003` | `SIGNER_DESTROYED` — Signing was attempted after the signer was destroyed.                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/local/error.ts#L7)  |
| `SIG_LOC_004` | `MESSAGE_SIGNER_DESTROYED` — SEP-53 signing was attempted after the local secret was destroyed. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/local/error.ts#L8)  |
| `SIG_LOC_005` | `MESSAGE_SIGNING_FAILED` — The native SDK could not sign the supplied SEP-53 message.           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/local/error.ts#L9)  |
| `SIG_LOC_006` | `MESSAGE_VERIFICATION_FAILED` — The native SDK rejected malformed SEP-53 verification inputs.   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/local/error.ts#L10) |
| `SIG_LOC_007` | `KEYPAIR_CANNOT_SIGN` — A public-only keypair cannot create a signing LocalSigner.              | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/local/error.ts#L11) |
| `SIG_LOC_008` | `KEYPAIR_ADAPTATION_FAILED` — A native keypair could not be adapted to a LocalSigner.           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/local/error.ts#L12) |
