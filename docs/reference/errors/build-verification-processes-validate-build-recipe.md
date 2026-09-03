# build-verification/processes/validate-build-recipe

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                                 | Source                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `BLDV_079` | `VALIDATE_RECIPE_UNEXPECTED` — Raised when recipe validation fails outside typed parser or policy errors. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L88) |
