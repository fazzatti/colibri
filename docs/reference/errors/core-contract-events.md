# core/contract/events

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                        | Source                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `CEV_001` | `INVALID_SPEC` — The declarations cannot be represented without ambiguity or invalid fields.     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/events/error.ts#L5) |
| `CEV_002` | `UNKNOWN_EVENT` — No declaration exists at the requested name and occurrence.                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/events/error.ts#L6) |
| `CEV_003` | `DECODE_FAILED` — An occurrence does not conform to its selected declaration.                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/events/error.ts#L7) |
| `CEV_004` | `INVALID_FILTER` — Filter arguments contain unknown or invalid indexed fields.                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/events/error.ts#L8) |
| `CEV_005` | `AMBIGUOUS_EVENT` — More than one declaration accepts the event. Select a definition explicitly. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/events/error.ts#L9) |
