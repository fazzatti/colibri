# core/pipelines/invoke-contract

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code            | Condition                                                                                                       | Source                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `PIPE_INVC_000` | `UNEXPECTED_ERROR` — Declared condition: unexpected error.                                                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/pipelines/invoke-contract/error.ts#L5) |
| `PIPE_INVC_001` | `MISSING_ARG` — Declared condition: missing arg.                                                                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/pipelines/invoke-contract/error.ts#L6) |
| `PIPE_INVC_002` | `MISSING_RPC_URL` — Declared condition: missing rpc url.                                                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/pipelines/invoke-contract/error.ts#L8) |
| `PIPE_INVC_003` | `EXPECTED_INVOKE_HOST_FUNCTION_OPERATION` — Raised when enforcement assembly receives a non-contract operation. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/pipelines/invoke-contract/error.ts#L9) |
