# core/sdex

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                         | Source                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `SDEX_001` | `CREATE_SELL_FAILED` — Native SDK rejected creation of a sell operation.                          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sdex/error.ts#L5)  |
| `SDEX_002` | `UPDATE_SELL_FAILED` — Native SDK rejected an update to a sell operation.                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sdex/error.ts#L6)  |
| `SDEX_003` | `CREATE_BUY_FAILED` — Native SDK rejected creation of a buy operation.                            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sdex/error.ts#L7)  |
| `SDEX_004` | `UPDATE_BUY_FAILED` — Native SDK rejected an update to a buy operation.                           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sdex/error.ts#L8)  |
| `SDEX_005` | `CREATE_PASSIVE_FAILED` — Native SDK rejected creation of a passive operation.                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sdex/error.ts#L9)  |
| `SDEX_006` | `OFFER_NOT_FOUND` — A known-offer cancellation found no live offer at the requested key.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sdex/error.ts#L10) |
| `SDEX_007` | `INVALID_UPDATE_SELL_ID` — The sell-update method requires an existing positive int64 offer ID.   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sdex/error.ts#L11) |
| `SDEX_008` | `INVALID_UPDATE_BUY_ID` — The buy-update method requires an existing positive int64 offer ID.     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sdex/error.ts#L12) |
| `SDEX_009` | `UNSAFE_OFFER_ID` — A numeric offer ID is not a safe integer and may already have lost precision. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/sdex/error.ts#L13) |
