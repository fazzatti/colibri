# core/sep1

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                  | Source                                                                             |
| ---------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `SEP1_001` | `FETCH_FAILED` — Raised when fetching `stellar.toml` fails.                                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sep1/error.ts#L65) |
| `SEP1_002` | `INVALID_DOMAIN` — Raised when the supplied domain is invalid.                             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sep1/error.ts#L66) |
| `SEP1_003` | `PARSE_ERROR` — Raised when `stellar.toml` content cannot be parsed as TOML.               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sep1/error.ts#L67) |
| `SEP1_004` | `FILE_TOO_LARGE` — Raised when `stellar.toml` exceeds the SEP-1 size limit.                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sep1/error.ts#L68) |
| `SEP1_005` | `INVALID_SIGNING_KEY` — Raised when a signing key value is not a valid Stellar account id. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sep1/error.ts#L69) |
| `SEP1_006` | `INVALID_URL` — Raised when a URL field in `stellar.toml` is invalid.                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sep1/error.ts#L70) |
| `SEP1_007` | `TIMEOUT` — Raised when fetching `stellar.toml` times out.                                 | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sep1/error.ts#L71) |
| `SEP1_008` | `INVALID_ACCOUNT` — Raised when an account field in `stellar.toml` is invalid.             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sep1/error.ts#L72) |
