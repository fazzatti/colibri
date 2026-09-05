# core/price

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                     | Source                                                                             |
| ---------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `PRCE_001` | `INVALID_DECIMAL` — Decimal price text does not use the documented plain decimal syntax.      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/price/error.ts#L5) |
| `PRCE_002` | `NON_POSITIVE_DECIMAL` — A decimal price must be strictly positive.                           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/price/error.ts#L6) |
| `PRCE_003` | `UNREPRESENTABLE_DECIMAL` — No exact positive int32 fraction represents the supplied decimal. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/price/error.ts#L7) |
| `PRCE_004` | `INVALID_RATIO` — A price fraction has a non-positive or out-of-range integer component.      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/price/error.ts#L8) |
