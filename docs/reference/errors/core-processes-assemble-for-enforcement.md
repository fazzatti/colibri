# core/processes/assemble-for-enforcement

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                             | Source                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `AFE_000` | `UNEXPECTED_ERROR` — Raised when assembly for enforcement fails unexpectedly.                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-for-enforcement/error.ts#L6) |
| `AFE_001` | `MISSING_TRANSACTION` — Raised when the transaction is missing from enforcement assembly input.       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-for-enforcement/error.ts#L7) |
| `AFE_002` | `MISSING_AUTHORIZED_OPERATION` — Raised when the authorized operation is missing from assembly input. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/assemble-for-enforcement/error.ts#L8) |
