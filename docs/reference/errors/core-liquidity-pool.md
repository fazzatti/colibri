# core/liquidity-pool

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code      | Condition                                                                                 | Source                                                                                       |
| --------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `NLP_001` | `INVALID_ASSET_PAIR` — Invalid or identical assets cannot identify a pool.                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/liquidity-pool/error.ts#L5)  |
| `NLP_002` | `FAILED_TO_CREATE_RPC` — The configured RPC endpoint could not be instantiated.           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/liquidity-pool/error.ts#L6)  |
| `NLP_003` | `FAILED_TO_BUILD_TRUSTLINE` — The native SDK rejected the trustline operation.            | [Definition](https://github.com/fazzatti/colibri/blob/main/core/liquidity-pool/error.ts#L7)  |
| `NLP_004` | `FAILED_TO_BUILD_DEPOSIT` — The native SDK rejected the deposit operation.                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/liquidity-pool/error.ts#L8)  |
| `NLP_005` | `FAILED_TO_BUILD_WITHDRAWAL` — The native SDK rejected the withdrawal operation.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/liquidity-pool/error.ts#L9)  |
| `NLP_006` | `FAILED_TO_READ_POOL` — RPC retrieval or decoding of the requested pool failed.           | [Definition](https://github.com/fazzatti/colibri/blob/main/core/liquidity-pool/error.ts#L10) |
| `NLP_007` | `POOL_NOT_FOUND` — A successful RPC lookup contained no entry for the pool.               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/liquidity-pool/error.ts#L11) |
| `NLP_008` | `INVALID_DEPOSIT_ASSETS` — Deposit maximums must name each pool asset exactly once.       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/liquidity-pool/error.ts#L12) |
| `NLP_009` | `INVALID_WITHDRAWAL_ASSETS` — Withdrawal minimums must name each pool asset exactly once. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/liquidity-pool/error.ts#L13) |
| `NLP_010` | `FAILED_TO_READ_TRUSTLINE` — RPC transport failed while reading a pool-share trustline.   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/liquidity-pool/error.ts#L14) |
