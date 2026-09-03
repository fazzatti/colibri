# core/common/helpers/format-units

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code         | Condition                                                                                      | Source                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `HLP_UNT_01` | `INVALID_DECIMALS` — Raised when the decimals argument is not a non-negative integer.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/common/helpers/format-units.error.ts#L7)  |
| `HLP_UNT_02` | `EMPTY_VALUE` — Raised when the value to format is empty.                                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/common/helpers/format-units.error.ts#L8)  |
| `HLP_UNT_03` | `INVALID_DECIMAL_INPUT` — Raised when the input cannot be parsed as a decimal value.           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/common/helpers/format-units.error.ts#L9)  |
| `HLP_UNT_04` | `TOO_MANY_FRACTION_DIGITS` — Raised when the value has more fractional digits than allowed.    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/common/helpers/format-units.error.ts#L10) |
| `HLP_UNT_05` | `NON_FINITE_NUMBER` — Raised when a numeric input is not finite.                               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/common/helpers/format-units.error.ts#L11) |
| `HLP_UNT_06` | `INVALID_SCIENTIFIC_NOTATION` — Raised when scientific notation is malformed.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/common/helpers/format-units.error.ts#L12) |
| `HLP_UNT_07` | `INVALID_SCIENTIFIC_EXPONENT` — Raised when a scientific-notation exponent is invalid.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/common/helpers/format-units.error.ts#L13) |
| `HLP_UNT_08` | `INVALID_MAX_FRACTION_DIGITS` — Raised when `maxFractionDigits` is not a non-negative integer. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/common/helpers/format-units.error.ts#L14) |
