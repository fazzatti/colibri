# core/resources

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                            | Source                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `RES_001` | `INVALID_CONFIGURATION` — The resource policy is malformed, ambiguous, or contains an invalid value. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/resources/error.ts#L5)  |
| `RES_002` | `BELOW_RECOMMENDATION` — An absolute override is smaller than the final simulation recommendation.   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/resources/error.ts#L6)  |
| `RES_003` | `LIMIT_EXCEEDED` — A resource value exceeds its representation or supplied network limit.            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/resources/error.ts#L7)  |
| `RES_004` | `MISSING_SIMULATION` — Resource configuration requires successful simulation data.                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/resources/error.ts#L8)  |
| `RES_005` | `UNSUPPORTED_TRANSACTION` — A Classic transaction cannot consume Soroban resource configuration.     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/resources/error.ts#L9)  |
| `RES_006` | `SETTINGS_UNAVAILABLE` — Required resource settings could not be read or are not supported.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/resources/error.ts#L10) |
