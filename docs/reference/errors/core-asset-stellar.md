# core/asset/stellar

[All error contexts](README.md) · [Handling errors](../../core/error.md)

Source-derived code definitions. Messages and metadata can contain runtime
values; branch on the code, not on message text. See the source definition for
constructors and diagnostic fields.

| Code       | Condition                                                                                                      | Source                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `STAS_001` | `INVALID_ASSET` — The supplied code/issuer cannot form a native SDK Asset.                                     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L5)  |
| `STAS_002` | `MISSING_RPC_URL` — Neither a native RPC server nor a configured URL was supplied.                             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L6)  |
| `STAS_003` | `INVALID_RPC` — The configured RPC endpoint cannot construct a native SDK server.                              | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L7)  |
| `STAS_004` | `NATIVE_TRUSTLINE` — Native XLM has no trustline to create, adjust, or remove.                                 | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L8)  |
| `STAS_005` | `CHANGE_TRUST_FAILED` — The SDK rejected arguments while constructing a trustline operation.                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L9)  |
| `STAS_006` | `TRANSFER_FAILED` — The SDK rejected arguments while constructing a payment operation.                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L10) |
| `STAS_007` | `NATIVE_TRUSTLINE_FLAGS` — Native XLM has no issuer-managed trustline flags.                                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L11) |
| `STAS_008` | `TRUSTLINE_FLAGS_FAILED` — The SDK rejected arguments while constructing a trustline-flags operation.          | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L12) |
| `STAS_009` | `NATIVE_CLAWBACK` — Native XLM cannot be clawed back by an issuer.                                             | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L13) |
| `STAS_010` | `CLAWBACK_FAILED` — The SDK rejected arguments while constructing a clawback operation.                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L14) |
| `STAS_011` | `READ_ISSUER_FAILED` — A non-Colibri RPC failure prevented reading the issuer account.                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L15) |
| `STAS_012` | `READ_TRUSTLINE_FAILED` — A non-Colibri RPC failure prevented reading the holder's trustline.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L16) |
| `STAS_013` | `NATIVE_ASSET_CODE_MISMATCH` — A native issuer marker was paired with a code other than XLM.                   | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L17) |
| `STAS_014` | `INVALID_CANONICAL_ASSET` — The supplied string is not an exact SEP-11 asset identity.                         | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L18) |
| `STAS_015` | `ISSUER_BALANCE_UNDEFINED` — An issuer has no finite native trustline balance of its own asset.                | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L19) |
| `STAS_016` | `BALANCE_TRUSTLINE_MISSING` — A requested balance cannot be read because no trustline exists.                  | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L20) |
| `STAS_017` | `READ_BALANCE_FAILED` — A transport failure prevented reading the native asset balance.                        | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L21) |
| `STAS_018` | `SAC_BINDING_FAILED` — The associated Stellar Asset Contract could not be bound.                               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L22) |
| `STAS_019` | `NATIVE_MINT` — Native XLM cannot be minted by a user account.                                                 | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L23) |
| `STAS_020` | `NATIVE_BURN` — Native XLM cannot be burned by paying an issuer.                                               | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L24) |
| `STAS_021` | `NATIVE_AUTHORIZATION` — Native XLM has no issuer-managed authorization.                                       | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L25) |
| `STAS_022` | `AUTHORIZATION_TRUSTLINE_MISSING` — Revocation cannot determine the current authorization without a trustline. | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L26) |
| `STAS_023` | `CREATE_CLAIMABLE_BALANCE_FAILED` — The SDK rejected the asset's claimable-balance construction arguments.     | [Definition](https://github.com/fazzatti/colibri/blob/main/core/asset/stellar/error.ts#L27) |
