# Asset

The Asset module provides utilities for working with Stellar asset
representations, native account operations, arbitrary SEP-41 token contracts,
and Stellar Asset Contracts (SAC).

## Native account operations

[`StellarAsset`](stellar-asset.md) provides explicit trustline, transfer,
authorization, and clawback actions through its owned transaction pipeline.
Issuer and trustline reads are separate and retain native SDK asset identity. It
does not invoke a contract or silently prepare accounts for a transfer.

For related native workflows, see [SDEX offers](../sdex.md),
[liquidity pools](../liquidity-pool.md), and
[claimable-balance predicates](../claimable-balance-predicates.md).

## Standards

| Standard                           | Description                                                  |
| ---------------------------------- | ------------------------------------------------------------ |
| [SEP-11](sep-11.md)                | Asset string format (`CODE:ISSUER` or `native`)              |
| [SEP-41](sep-41-token-contract.md) | Standard Soroban token client and custom-method escape hatch |

## Contracts

| Contract                                            | Description                                           |
| --------------------------------------------------- | ----------------------------------------------------- |
| [Stellar Asset Contract](stellar-asset-contract.md) | Client for interacting with SAC (SEP-41, CAP-0046-06) |

Use `SEP41TokenContract` for the portable token interface implemented by custom
contracts and SACs. Use `StellarAssetContract` when the application also needs
classic-asset identity, trustline, authorization, or SAC administrative methods.
