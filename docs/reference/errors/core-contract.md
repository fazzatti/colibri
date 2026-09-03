# core/contract

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code        | Condition                                                                                                                      | Source                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `CONTR_000` | `UNEXPECTED_ERROR` — Declared condition: unexpected error.                                                                     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L63) |
| `CONTR_001` | `MISSING_ARG` — Raised when a required contract constructor argument is missing.                                               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L64) |
| `CONTR_002` | `MISSING_RPC_URL` — Raised when no RPC server can be derived for the contract instance.                                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L65) |
| `CONTR_003` | `INVALID_CONTRACT_CONFIG` — Raised when contract construction does not provide usable contract identity.                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L66) |
| `CONTR_004` | `FAILED_TO_UPLOAD_WASM` — Raised when uploading WASM binaries fails.                                                           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L67) |
| `CONTR_005` | `MISSING_REQUIRED_PROPERTY` — Raised when a required contract property has not been initialized.                               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L68) |
| `CONTR_006` | `PROPERTY_ALREADY_SET` — Raised when code tries to mutate an immutable contract property.                                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L69) |
| `CONTR_007` | `MISSING_SPEC_IN_WASM` — Raised when the loaded WASM does not contain a contract specification.                                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L70) |
| `CONTR_008` | `FAILED_TO_DEPLOY_CONTRACT` — Raised when deploying a contract fails.                                                          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L71) |
| `CONTR_009` | `CONTRACT_INSTANCE_NOT_FOUND` — Raised when a contract instance ledger entry cannot be found.                                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L72) |
| `CONTR_010` | `CONTRACT_CODE_NOT_FOUND` — Raised when uploaded contract code cannot be found on chain.                                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L73) |
| `CONTR_011` | `INVALID_CONTRACT_ID` — Raised when a contract id does not match the expected format.                                          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L74) |
| `CONTR_012` | `CONTRACT_ERROR_MATCHER_ALREADY_CONFIGURED` — Raised when automatic contract-error loading would duplicate the matcher plugin. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L75) |
| `CONTR_013` | `CONTRACT_CONFIG_SOURCES_CONFLICT` — Raised when multiple mutually exclusive contract sources are configured.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L76) |
| `CONTR_014` | `STELLAR_ASSET_EXECUTABLE_HAS_NO_WASM` — Raised when a Stellar Asset Contract is queried for a Wasm hash.                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L77) |
| `CONTR_015` | `NETWORK_EXECUTABLE_NOT_AVAILABLE` — Raised when network loading has no deployed or uploaded executable source.                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/contract/error.ts#L78) |
