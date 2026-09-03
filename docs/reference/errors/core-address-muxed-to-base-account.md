# core/address/muxed-to-base-account

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code            | Condition                                                                                                    | Source                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `ADDR_MTBA_001` | `INVALID_MUXED_ADDRESS` — Declared condition: invalid muxed address.                                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/address/muxed-to-base-account/error.ts#L7) |
| `ADDR_MTBA_002` | `FAILED_TO_LOAD_MUXED_ACCOUNT_FROM_ADDRESS` — Declared condition: failed to load muxed account from address. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/address/muxed-to-base-account/error.ts#L8) |
| `ADDR_MTBA_003` | `FAILED_TO_RETRIEVE_THE_BASE_ACCOUNT_ID` — Declared condition: failed to retrieve the base account id.       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/address/muxed-to-base-account/error.ts#L9) |
