# build-verification/processes/resolve-source-archive

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                              | Source                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `BLDV_080` | `RESOLVE_SOURCE_UNEXPECTED` — Raised when source resolution fails outside its typed provider contract. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L89) |
