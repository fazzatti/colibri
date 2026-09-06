# core/claimable-balance

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                             | Source                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `CBPR_001` | `INVALID_DATE` — A Date is invalid or is before the Unix epoch.                                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/claimable-balance/error.ts#L5)  |
| `CBPR_002` | `INVALID_ABSOLUTE_TIME` — Absolute seconds must be a nonnegative signed int64 without precision loss. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/claimable-balance/error.ts#L6)  |
| `CBPR_003` | `INVALID_RELATIVE_TIME` — Relative seconds must be a nonnegative signed int64 without precision loss. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/claimable-balance/error.ts#L7)  |
| `CBPR_004` | `INVALID_PREDICATE` — A supplied child is not a native SDK ClaimPredicate.                            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/claimable-balance/error.ts#L8)  |
| `CBPR_005` | `EXCESSIVE_DEPTH` — A predicate tree exceeds Stellar's four levels, counting its root as one.         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/claimable-balance/error.ts#L9)  |
| `CBPR_006` | `INVALID_AND_ARITY` — A native AND predicate does not have exactly two children.                      | [Definition](https://github.com/fazzatti/colibri/blob/main/core/claimable-balance/error.ts#L10) |
| `CBPR_007` | `INVALID_OR_ARITY` — A native OR predicate does not have exactly two children.                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/claimable-balance/error.ts#L11) |
| `CBPR_008` | `EMPTY_NOT` — A native NOT predicate has no child.                                                    | [Definition](https://github.com/fazzatti/colibri/blob/main/core/claimable-balance/error.ts#L12) |
| `CBPR_009` | `INVALID_ABSOLUTE_PREDICATE` — A supplied native absolute-time predicate has invalid int64 seconds.   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/claimable-balance/error.ts#L13) |
| `CBPR_010` | `INVALID_RELATIVE_PREDICATE` — A supplied native relative-time predicate has invalid int64 seconds.   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/claimable-balance/error.ts#L14) |
| `CBPR_011` | `EMPTY_ALL_OF` — An AND list must not silently become unconditional.                                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/claimable-balance/error.ts#L15) |
| `CBPR_012` | `EMPTY_ANY_OF` — An OR list must contain a condition.                                                 | [Definition](https://github.com/fazzatti/colibri/blob/main/core/claimable-balance/error.ts#L16) |
| `CBPR_013` | `EMPTY_TIME_WINDOW` — No integer ledger-close time satisfies the requested time window.               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/claimable-balance/error.ts#L17) |
