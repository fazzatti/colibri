# core/pipelines/classic-transaction

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code            | Condition                                                  | Source                                                                                                     |
| --------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `PIPE_CLTX_000` | `UNEXPECTED_ERROR` — Declared condition: unexpected error. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/pipelines/classic-transaction/error.ts#L5) |
| `PIPE_CLTX_001` | `MISSING_ARG` — Declared condition: missing arg.           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/pipelines/classic-transaction/error.ts#L6) |
| `PIPE_CLTX_002` | `MISSING_RPC_URL` — Declared condition: missing rpc url.   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/pipelines/classic-transaction/error.ts#L8) |
