# build-verification/pipelines/build-verification

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                              | Source                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `BLDV_075` | `PIPELINE_CONSTRUCTION_FAILED` — Raised when pipeline construction fails outside its typed validation. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L84)  |
| `BLDV_076` | `PROCESS_DEPENDENCY_MISSING` — Raised when required pipeline dependencies are absent.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L85)  |
| `BLDV_094` | `PIPELINE_STEP_OUTPUT_MISSING` — Raised when a connector cannot read a required preceding step output. | [Definition](https://github.com/fazzatti/colibri/blob/main/build-verification/src/error/base.ts#L103) |
