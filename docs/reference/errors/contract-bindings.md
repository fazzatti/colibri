# contract-bindings

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                             | Source                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `CBG_001` | `INVALID_OPTIONS` — Declared condition: invalid options.                                              | [Definition](https://github.com/fazzatti/colibri/blob/main/contract-bindings/src/error.ts#L5)  |
| `CBG_002` | `INVALID_SPEC` — Declared condition: invalid spec.                                                    | [Definition](https://github.com/fazzatti/colibri/blob/main/contract-bindings/src/error.ts#L6)  |
| `CBG_003` | `SOURCE_FAILED` — Declared condition: source failed.                                                  | [Definition](https://github.com/fazzatti/colibri/blob/main/contract-bindings/src/error.ts#L7)  |
| `CBG_004` | `OUTPUT_FAILED` — Declared condition: output failed.                                                  | [Definition](https://github.com/fazzatti/colibri/blob/main/contract-bindings/src/error.ts#L8)  |
| `CBG_005` | `CANCELLED` — Declared condition: cancelled.                                                          | [Definition](https://github.com/fazzatti/colibri/blob/main/contract-bindings/src/error.ts#L9)  |
| `CBG_006` | `RESULT_DECODE_FAILED` — A submitted transaction succeeded but its return value could not be decoded. | [Definition](https://github.com/fazzatti/colibri/blob/main/contract-bindings/src/error.ts#L11) |
