# core/account/native

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code          | Condition                                                                                                     | Source                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `ACC_NAT_001` | `INVALID_ED25519_PUBLIC_KEY` — Raised when the provided public key is not a valid Stellar ed25519 account id. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/account/native/error.ts#L8)  |
| `ACC_NAT_002` | `INVALID_MUXED_ID` — Raised when the provided muxed id is not a valid uint64 string.                          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/account/native/error.ts#L9)  |
| `ACC_NAT_003` | `INVALID_MUXED_ADDRESS_GENERATED` — Raised when generating a muxed address produces an invalid value.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/account/native/error.ts#L10) |
| `ACC_NAT_004` | `MISSING_MASTER_SIGNER` — Raised when a native account is used without a master signer.                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/account/native/error.ts#L11) |
| `ACC_NAT_005` | `UNSUPPORTED_ADDRESS_TYPE` — Raised when the provided address type is unsupported by native accounts.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/account/native/error.ts#L12) |
