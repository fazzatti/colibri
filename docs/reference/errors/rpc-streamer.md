# rpc-streamer

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                  | Source                                                                                     |
| --------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `RPC_001` | `INVALID_CONFIG` — Invalid configuration provided                          | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L15) |
| `RPC_002` | `INVALID_RPC` — Invalid RPC instance                                       | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L18) |
| `RPC_003` | `HEALTH_CHECK_FAILED` — RPC health check failed                            | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L21) |
| `RPC_004` | `LIVE_FETCH_FAILED` — Live RPC fetch operation failed                      | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L24) |
| `RPC_005` | `ARCHIVE_FETCH_FAILED` — Archive RPC fetch operation failed                | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L27) |
| `RPC_006` | `PARSE_FAILED` — Data parsing failed                                       | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L30) |
| `RPC_007` | `INVALID_SEQUENCE_RANGE` — Invalid sequence range                          | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L33) |
| `RPC_008` | `ALREADY_RUNNING` — Stream is already running                              | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L36) |
| `RPC_009` | `NOT_RUNNING` — Stream is not running                                      | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L39) |
| `RPC_010` | `MAX_FAILURES_EXCEEDED` — Maximum consecutive failures exceeded            | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L42) |
| `RPC_011` | `RPC_ALREADY_SET` — RPC server is already set                              | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L45) |
| `RPC_012` | `ARCHIVE_RPC_ALREADY_SET` — Archive RPC server is already set              | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L48) |
| `RPC_013` | `RPC_NOT_HEALTHY` — RPC server is not healthy                              | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L51) |
| `RPC_014` | `LEDGER_TOO_OLD` — Ledger is too old (outside RPC retention window)        | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L54) |
| `RPC_015` | `LEDGER_TOO_HIGH` — Ledger is too high (ahead of latest available)         | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L57) |
| `RPC_016` | `MISSING_ARCHIVE_RPC` — Archive RPC is required but not configured         | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L60) |
| `RPC_017` | `MISSING_LIVE_INGESTOR` — Live ingestor is required but not provided       | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L63) |
| `RPC_018` | `MISSING_ARCHIVE_INGESTOR` — Archive ingestor is required but not provided | [Definition](https://github.com/fazzatti/colibri/blob/main/rpc-streamer/src/errors.ts#L66) |
