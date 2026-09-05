# core/sponsorship

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                        | Source                                                                                   |
| ---------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `SPNS_001` | `INVALID_SPONSOR` — The sponsor is not a valid G or M operation source.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sponsorship/error.ts#L5) |
| `SPNS_002` | `INVALID_SPONSORED_ACCOUNT` — The sponsored account is not a valid G account ID. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sponsorship/error.ts#L6) |
