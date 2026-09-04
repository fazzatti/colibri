# core/event

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                    | Source                                                                              |
| --------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `EVT_001` | `INVALID_CONTRACT_ID` — Declared condition: invalid contract id.                             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/error.ts#L45) |
| `EVT_002` | `INVALID_EVENT_ID` — Declared condition: invalid event id.                                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/error.ts#L46) |
| `EVT_003` | `UNKNOWN_EVENT_TYPE` — Declared condition: unknown event type.                               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/error.ts#L47) |
| `EVT_004` | `UNKNOWN_FIELD` — Declared condition: unknown field.                                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/error.ts#L48) |
| `EVT_005` | `EVENT_SCHEMA_MISMATCH` — Declared condition: event schema mismatch.                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/error.ts#L49) |
| `EVT_006` | `UNSUPPORTED_SCHEMA_FIELD_TYPE` — Declared condition: unsupported schema field type.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/error.ts#L50) |
| `EVT_007` | `INVALID_EVENT_DATA_FORMAT` — Declared condition: invalid event data format.                 | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/error.ts#L51) |
| `EVT_008` | `INVALID_EVENT_ASSET_FORMAT` — Declared condition: invalid event asset format.               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/error.ts#L52) |
| `EVT_009` | `TRANSFER_EXTENSION_DECODER_FAILED` — Declared condition: transfer extension decoder failed. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/error.ts#L53) |
| `EVT_010` | `APPROVE_EXTENSION_DECODER_FAILED` — Declared condition: approve extension decoder failed.   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/error.ts#L54) |
| `EVT_011` | `BURN_EXTENSION_DECODER_FAILED` — Declared condition: burn extension decoder failed.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/error.ts#L55) |
| `EVT_012` | `MINT_EXTENSION_DECODER_FAILED` — Declared condition: mint extension decoder failed.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/error.ts#L56) |
| `EVT_013` | `CLAWBACK_EXTENSION_DECODER_FAILED` — Declared condition: clawback extension decoder failed. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/error.ts#L57) |
