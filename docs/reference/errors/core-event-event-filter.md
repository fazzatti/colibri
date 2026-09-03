# core/event/event-filter

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                    | Source                                                                                           |
| --------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `EVF_001` | `EVENT_HAS_NO_TOPICS` — Raised when topic matching is requested for an event with no topics. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/event-filter/error.ts#L65) |
| `EVF_002` | `FAILED_TO_CHECK_FILTER_SEGMENT` — Raised when topic segment comparison fails unexpectedly.  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/event/event-filter/error.ts#L66) |
