# core/signer/delegated

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code          | Condition                                                                                                    | Source                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `SIG_DEL_001` | `DUPLICATE_NESTED_DELEGATE` — Raised when two siblings represent the same delegate address.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/delegated/error.ts#L8)  |
| `SIG_DEL_002` | `FAILED_TO_BUILD_DELEGATED_ENTRY` — Raised when the SDK cannot materialize the configured delegate topology. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/delegated/error.ts#L9)  |
| `SIG_DEL_003` | `FAILED_TO_AUTHORIZE_DELEGATE` — Raised when a signer cannot authorize its configured credential node.       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/signer/delegated/error.ts#L10) |
