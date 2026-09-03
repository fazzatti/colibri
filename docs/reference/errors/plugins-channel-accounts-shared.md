# plugins/channel-accounts/shared

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code          | Condition                                                                                                 | Source                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `PLG_CHA_000` | `UNEXPECTED_ERROR` — Wraps unexpected non-Colibri exceptions raised by the package internals.             | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L7)  |
| `PLG_CHA_001` | `MISSING_ARG` — Raised when a required argument is omitted from a public API call.                        | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L8)  |
| `PLG_CHA_002` | `INVALID_NUMBER_OF_CHANNELS` — Raised when channel creation requests an out-of-bounds number of channels. | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L9)  |
| `PLG_CHA_003` | `CHANNEL_NOT_ALLOCATED` — Raised when a plugin run tries to release a channel that is not allocated.      | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L10) |
