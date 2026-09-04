# Asset

The Asset module provides utilities for working with Stellar asset
representations, arbitrary SEP-41 token contracts, and Stellar Asset Contracts
(SAC).

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
