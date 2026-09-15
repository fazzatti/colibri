# react

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code        | Condition                                                                                     | Source                                                                             |
| ----------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `REACT_001` | `MISSING_PROVIDER` — Provider context is absent.                                              | [Definition](https://github.com/fazzatti/colibri/blob/main/react/src/error.ts#L5)  |
| `REACT_002` | `INVALID_CONFIG` — Provider or feature configuration is invalid.                              | [Definition](https://github.com/fazzatti/colibri/blob/main/react/src/error.ts#L7)  |
| `REACT_003` | `UNSUPPORTED_CAPABILITY` — The wallet did not advertise this signing capability.              | [Definition](https://github.com/fazzatti/colibri/blob/main/react/src/error.ts#L9)  |
| `REACT_004` | `CONNECTION_CHANGED` — An outstanding operation belongs to an obsolete connection.            | [Definition](https://github.com/fazzatti/colibri/blob/main/react/src/error.ts#L11) |
| `REACT_005` | `INVALID_QUERY_VALUE` — A cache input cannot be represented canonically.                      | [Definition](https://github.com/fazzatti/colibri/blob/main/react/src/error.ts#L13) |
| `REACT_006` | `INVALID_METHOD` — A contract method is unavailable.                                          | [Definition](https://github.com/fazzatti/colibri/blob/main/react/src/error.ts#L15) |
| `REACT_007` | `NETWORK_MISMATCH` — A client or wallet reports another network.                              | [Definition](https://github.com/fazzatti/colibri/blob/main/react/src/error.ts#L17) |
| `REACT_008` | `INVALID_SESSION` — The returned token is expired or not bound to the authenticated exchange. | [Definition](https://github.com/fazzatti/colibri/blob/main/react/src/error.ts#L19) |
