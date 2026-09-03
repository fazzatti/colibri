# test-tooling/quickstart

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code          | Condition                                                                                          | Source                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `TTO_QKS_001` | `INVALID_CONFIGURATION` — Raised when a user-facing quickstart option is unsupported or malformed. | [Definition](https://github.com/fazzatti/colibri/blob/main/test-tooling/quickstart/error.ts#L38) |
| `TTO_QKS_002` | `DOCKER_CONFIGURATION_ERROR` — Raised when Docker connection settings are ambiguous or invalid.    | [Definition](https://github.com/fazzatti/colibri/blob/main/test-tooling/quickstart/error.ts#L39) |
| `TTO_QKS_003` | `CONTAINER_ERROR` — Raised when container lifecycle or inspection operations fail.                 | [Definition](https://github.com/fazzatti/colibri/blob/main/test-tooling/quickstart/error.ts#L40) |
| `TTO_QKS_004` | `IMAGE_ERROR` — Raised when the quickstart image cannot be pulled or streamed correctly.           | [Definition](https://github.com/fazzatti/colibri/blob/main/test-tooling/quickstart/error.ts#L41) |
| `TTO_QKS_005` | `READINESS_ERROR` — Raised when the quickstart services never become ready for use.                | [Definition](https://github.com/fazzatti/colibri/blob/main/test-tooling/quickstart/error.ts#L42) |
