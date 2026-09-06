# core/asset/native/amount

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                     | Source                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `AMNT_001` | `INVALID_DECIMAL` — An amount must be expressed as nonnegative plain decimal text.            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/native/amount.error.ts#L5) |
| `AMNT_002` | `EXCESS_PRECISION` — A decimal would lose information at native seven-decimal precision.      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/native/amount.error.ts#L6) |
| `AMNT_003` | `DECIMAL_OVERFLOW` — An exact decimal amount exceeds the native signed-64-bit quantity range. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/native/amount.error.ts#L7) |
| `AMNT_004` | `INVALID_UNITS` — Formatting requires nonnegative signed-64-bit integer units.                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/native/amount.error.ts#L8) |
