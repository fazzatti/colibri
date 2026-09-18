# test-tooling/recorder

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code          | Condition                                                                         | Source                                                                                        |
| ------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `TTO_REC_001` | `INVALID_CONFIGURATION` — Invalid recorder limits or CLI/configuration arguments. | [Definition](https://github.com/fazzatti/colibri/blob/main/test-tooling/recorder/error.ts#L3) |
| `TTO_REC_002` | `INVALID_ARTIFACT` — Malformed, incompatible, or mixed-run evidence.              | [Definition](https://github.com/fazzatti/colibri/blob/main/test-tooling/recorder/error.ts#L4) |
