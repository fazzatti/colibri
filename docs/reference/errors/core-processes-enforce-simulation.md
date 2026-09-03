# core/processes/enforce-simulation

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                            | Source                                                                                                    |
| --------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `EFS_000` | `UNEXPECTED_ERROR` — Raised when enforcing simulation fails unexpectedly.                            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/enforce-simulation/error.ts#L6) |
| `EFS_001` | `MISSING_TRANSACTION` — Raised when the transaction is missing from enforcing-simulation input.      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/enforce-simulation/error.ts#L7) |
| `EFS_002` | `MISSING_RECORDING_SIMULATION` — Raised when the recording simulation is missing from process input. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/enforce-simulation/error.ts#L8) |
| `EFS_003` | `MISSING_RPC` — Raised when the RPC client is missing from enforcing-simulation input.               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/enforce-simulation/error.ts#L9) |
