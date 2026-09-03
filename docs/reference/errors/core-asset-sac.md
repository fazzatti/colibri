# core/asset/sac

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                          | Source                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `SAC_000` | `UNEXPECTED_ERROR` — Declared condition: unexpected error.                                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sac/error.ts#L64) |
| `SAC_001` | `MISSING_ARG` — Raised when a required SAC argument is missing.                                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sac/error.ts#L65) |
| `SAC_002` | `FAILED_TO_DEPLOY_CONTRACT` — Raised when the SAC deployment for a classic asset fails.            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sac/error.ts#L66) |
| `SAC_003` | `UNMATCHED_CONTRACT_ID` — Raised when a deployment response resolves to an unexpected contract id. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sac/error.ts#L67) |
| `SAC_004` | `MISSING_RETURN_VALUE` — Raised when a SAC read path returns no value where one was expected.      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sac/error.ts#L68) |
