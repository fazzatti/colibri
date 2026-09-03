# core/ledger-parser

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                                                                                                                            | Source                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `LDP_001` | `INVALID_LEDGER_ENTRY` — Thrown when the LedgerEntry object is malformed.                                                                                                                            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-parser/error.ts#L66) |
| `LDP_002` | `INVALID_HEADER_XDR` — Thrown when header XDR decoding fails.                                                                                                                                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-parser/error.ts#L67) |
| `LDP_003` | `INVALID_METADATA_XDR` — Thrown when metadata XDR decoding fails.                                                                                                                                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-parser/error.ts#L68) |
| `LDP_004` | `UNSUPPORTED_LEDGER_CLOSE_META_VERSION` — Thrown when an unsupported LedgerCloseMeta version is encountered. Currently supports V0, V1, and V2. Future protocol upgrades may introduce new versions. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-parser/error.ts#L69) |
| `LDP_005` | `INVALID_TRANSACTION_INDEX` — Thrown when attempting to access transaction data that doesn't exist.                                                                                                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-parser/error.ts#L70) |
| `LDP_006` | `INVALID_OPERATION_INDEX` — Thrown when attempting to access operation data that doesn't exist.                                                                                                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-parser/error.ts#L71) |
| `LDP_007` | `UNSUPPORTED_OPERATION_TYPE` — Thrown when encountering an unknown operation type.                                                                                                                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-parser/error.ts#L72) |
| `LDP_008` | `MISSING_TRANSACTION_ENVELOPE` — Thrown when envelope-dependent transaction data is requested but unavailable.                                                                                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-parser/error.ts#L73) |
| `LDP_009` | `UNSUPPORTED_ENVELOPE_TYPE` — Thrown when a transaction envelope type is not supported by the parser.                                                                                                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/ledger-parser/error.ts#L74) |
