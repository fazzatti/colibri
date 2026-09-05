# plugins/sep29

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code            | Condition                                                                                                  | Source                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `PLG_SEP29_001` | `INVALID_TRANSACTION` — The checker did not receive a native transaction or fee-bump transaction.          | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/sep29/src/error.ts#L6) |
| `PLG_SEP29_002` | `FAILED_TO_CREATE_READER` — The provided network/client configuration could not construct a ledger reader. | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/sep29/src/error.ts#L7) |
| `PLG_SEP29_003` | `FAILED_TO_READ_REQUIREMENTS` — RPC or data decoding failed; submission must not silently skip the check.  | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/sep29/src/error.ts#L8) |
| `PLG_SEP29_004` | `MEMO_REQUIRED` — A non-muxed destination requires a memo, but the transaction has MEMO_NONE.              | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/sep29/src/error.ts#L9) |
