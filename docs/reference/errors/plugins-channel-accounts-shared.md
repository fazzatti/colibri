# plugins/channel-accounts/shared

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code          | Condition                                                                                                       | Source                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `PLG_CHA_000` | `UNEXPECTED_ERROR` — Wraps unexpected non-Colibri exceptions raised by the package internals.                   | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L7)  |
| `PLG_CHA_001` | `MISSING_ARG` — Raised when a required argument is omitted from a public API call.                              | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L8)  |
| `PLG_CHA_002` | `INVALID_NUMBER_OF_CHANNELS` — Raised when channel creation requests an out-of-bounds number of channels.       | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L9)  |
| `PLG_CHA_003` | `CHANNEL_NOT_ALLOCATED` — Raised when a plugin run tries to release a channel that is not allocated.            | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L10) |
| `PLG_CHA_004` | `INVALID_CONCURRENCY` — Raised before RPC work when the requested async capacity is invalid.                    | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L11) |
| `PLG_CHA_005` | `INVALID_WORKER_CONFIGURATION` — Raised when a channel-worker definition or executor configuration is invalid.  | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L12) |
| `PLG_CHA_006` | `CHANNEL_WORKERS_CLOSED` — Raised when a stopped channel-worker owner receives a new or waiting request.        | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L13) |
| `PLG_CHA_007` | `CHANNEL_WORKER_CAPACITY` — Raised before a request acquires a channel when the admission limit is full.        | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L14) |
| `PLG_CHA_008` | `CHANNELS_UNAVAILABLE` — Raised when every channel is quarantined or unavailable and no request can proceed.    | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L15) |
| `PLG_CHA_009` | `CHANNEL_BINDING_MISMATCH` — Raised inside a worker before execution when its assigned account does not match.  | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L16) |
| `PLG_CHA_010` | `INVALID_WORKER_PAYLOAD` — Raised before admission when request arguments cannot cross the worker boundary.     | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L17) |
| `PLG_CHA_011` | `CHANNEL_WORKER_FAILED` — Describes a worker execution failure and whether its channel requires reconciliation. | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L18) |
| `PLG_CHA_012` | `INVALID_CHANNEL_CONFIGURATION` — Raised when a local channel executor has no accounts or no executable.        | [Definition](https://github.com/fazzatti/colibri/blob/main/plugins/channel-accounts/src/shared/error.ts#L19) |
