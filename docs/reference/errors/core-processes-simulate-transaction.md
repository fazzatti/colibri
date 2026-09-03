# core/processes/simulate-transaction

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                                   | Source                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `SIM_000` | `UNEXPECTED_ERROR` — An unexpected non-Colibri error escaped simulation handling.                           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/simulate-transaction/error.ts#L17) |
| `SIM_001` | `SIMULATION_FAILED` — RPC returned a simulation error response without a parsed contract error.             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/simulate-transaction/error.ts#L19) |
| `SIM_002` | `COULD_NOT_SIMULATE_TRANSACTION` — RPC simulation could not be executed because the RPC call failed.        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/simulate-transaction/error.ts#L21) |
| `SIM_003` | `SIMULATION_RESULT_NOT_VERIFIED` — RPC returned a simulation payload that Colibri could not classify.       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/simulate-transaction/error.ts#L23) |
| `SIM_004` | `CONTRACT_ERROR_SIMULATION_FAILED` — RPC returned a simulation error response with a parsed contract error. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/processes/simulate-transaction/error.ts#L25) |
