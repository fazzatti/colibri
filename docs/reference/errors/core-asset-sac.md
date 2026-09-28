# core/asset/sac

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                                                             | Source                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `SAC_000` | `UNEXPECTED_ERROR` — Error code to constructor map for SAC errors. Reserved unexpected-failure code, now exposed as a concrete error. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sac/error.ts#L64) |
| `SAC_001` | `MISSING_ARG` — Raised when a required SAC argument is missing.                                                                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sac/error.ts#L65) |
| `SAC_002` | `FAILED_TO_DEPLOY_CONTRACT` — Raised when the SAC deployment for a classic asset fails.                                               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sac/error.ts#L66) |
| `SAC_003` | `UNMATCHED_CONTRACT_ID` — Raised when deployment or resolved asset identity yields an unexpected id.                                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sac/error.ts#L67) |
| `SAC_004` | `MISSING_RETURN_VALUE` — Raised when a SAC read path returns no value where one was expected.                                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sac/error.ts#L68) |
| `SAC_005` | `NOT_STELLAR_ASSET_CONTRACT` — Raised when a contract id identifies a custom contract rather than an SAC.                             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sac/error.ts#L69) |
| `SAC_006` | `INVALID_ASSET_METADATA` — Raised when an SAC instance has no valid canonical asset name.                                             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/sac/error.ts#L70) |
