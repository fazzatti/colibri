# build-verification/reporting

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                    | Source                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `BLDV_030` | `EVIDENCE_WRITE_FAILED` — Raised when verification evidence cannot be exported atomically.   | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L40) |
| `BLDV_073` | `LOG_WRITE_FAILED` — Raised when structured verification logs cannot be exported atomically. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L82) |
| `BLDV_074` | `LOGGER_FAILED` — Raised when a caller-selected strict logger fails.                         | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L83) |
