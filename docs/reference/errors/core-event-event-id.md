# core/event/event-id

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                              | Source                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `EVI_001` | `EVENT_INDEX_OUT_OF_RANGE` — Raised when the event segment of an event id exceeds the supported range. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/event-id/error.ts#L54) |
| `EVI_002` | `INVALID_EVENT_ID_FORMAT` — Raised when an event id does not follow the expected serialized format.    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/event-id/error.ts#L55) |
