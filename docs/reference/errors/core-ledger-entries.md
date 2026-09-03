# core/ledger-entries

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                                               | Source                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `LDE_000` | `INVALID_CONSTRUCTOR_ARGS` — Raised when the constructor receives both or neither supported init inputs.                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L63) |
| `LDE_001` | `MISSING_RPC_URL` — Raised when a network config does not provide an RPC URL.                                           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L64) |
| `LDE_002` | `INVALID_ACCOUNT_ID` — Raised when an invalid Ed25519 account id is provided.                                           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L65) |
| `LDE_003` | `INVALID_CONTRACT_ID` — Raised when an invalid contract id is provided.                                                 | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L66) |
| `LDE_004` | `INVALID_CLAIMABLE_BALANCE_ID` — Raised when an invalid claimable-balance id is provided.                               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L67) |
| `LDE_005` | `INVALID_LIQUIDITY_POOL_ID` — Raised when an invalid liquidity-pool id is provided.                                     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L68) |
| `LDE_006` | `INVALID_HEX_HASH` — Raised when a hash argument is not a 32-byte hex string.                                           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L69) |
| `LDE_007` | `INVALID_CONFIG_SETTING_ID` — Raised when a config-setting id is not recognized.                                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L70) |
| `LDE_008` | `INVALID_LEDGER_KEY_HASH` — Raised when a TTL key hash is invalid.                                                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L71) |
| `LDE_009` | `LEDGER_ENTRY_NOT_FOUND` — Raised when a convenience method cannot find the requested entry.                            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L72) |
| `LDE_010` | `UNEXPECTED_LEDGER_ENTRY_TYPE` — Raised when the RPC response does not match the requested ledger-key type.             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L73) |
| `LDE_011` | `CONTRACT_INSTANCE_HAS_NO_WASM_HASH` — Raised when a contract instance points at a built-in executable instead of wasm. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L74) |
| `LDE_012` | `UNSUPPORTED_RPC_LEDGER_KEY` — Raised when Stellar RPC does not support querying a ledger-key type.                     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L75) |
| `LDE_013` | `UNSUPPORTED_XDR_VARIANT` — Raised when a decoded Stellar XDR union variant is unsupported.                             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L76) |
| `LDE_014` | `INVALID_OFFER_ID` — Raised when an invalid offer id is provided.                                                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L77) |
| `LDE_015` | `INVALID_EXTERNAL_REFERENCE` — Raised when an external executable reference cannot be decoded.                          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L78) |
| `LDE_016` | `EXTERNAL_REFERENCE_OWNER_NOT_CONTRACT` — Raised when an executable-reference owner is not a contract address.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L79) |
| `LDE_017` | `EXTERNAL_REFERENCE_ENTRY_NOT_FOUND` — Raised when the owner has no live persistent mapping for a referenced tag.       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L80) |
| `LDE_018` | `EXTERNAL_REFERENCE_VALUE_INVALID` — Raised when an executable-tag entry does not contain a 32-byte Wasm hash.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-entries/error.ts#L81) |
