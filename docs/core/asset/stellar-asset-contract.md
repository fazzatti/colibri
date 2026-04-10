# Stellar Asset Contract

`StellarAssetContract` is Colibri's high-level client for Stellar Asset
Contracts (SACs), the built-in Soroban contracts that bridge classic Stellar
assets into the Soroban ecosystem.

SACs implement the token interface used by Stellar's built-in asset wrapper and
are defined in [CAP-0046-06](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-06.md).

## Overview

A SAC client is always bound to a contract id. You can create that client from:

- a known `contractId`
- a classic asset identity (`code` + `issuer`)
- a `stellar-sdk` `Asset`
- the native XLM asset

## Creating A SAC Client

### From A Classic Asset

```ts
import { NetworkConfig, StellarAssetContract } from "@colibri/core";

const sac = StellarAssetContract.fromAsset({
  networkConfig: NetworkConfig.TestNet(),
  code: "USDC",
  issuer: "GCNY5OXYSY4FKHOPT2SPOQZAOEIGXB5LBYW3HVU3OWSTQITS65M5RCNY",
});

console.log(sac.contractId);
```

### From A Known Contract Id

```ts
const sac = StellarAssetContract.fromContractId({
  networkConfig: NetworkConfig.TestNet(),
  contractId: "CBI...",
});
```

### Native XLM

```ts
const sac = StellarAssetContract.NativeXLM({
  networkConfig: NetworkConfig.TestNet(),
});
```

### Constructor Form

You can also instantiate directly:

```ts
const sac = new StellarAssetContract({
  networkConfig: NetworkConfig.TestNet(),
  contractId: "CBI...",
});
```

## Deploying A SAC

The deployment flow is a static factory that returns a ready client:

```ts
import { LocalSigner, NetworkConfig, StellarAssetContract } from "@colibri/core";

const signer = LocalSigner.fromSecret("S...");

const sac = await StellarAssetContract.deploy({
  networkConfig: NetworkConfig.TestNet(),
  code: "USDC",
  issuer: "GCNY5OXYSY4FKHOPT2SPOQZAOEIGXB5LBYW3HVU3OWSTQITS65M5RCNY",
  config: {
    fee: "10000000",
    timeout: 30,
    source: signer.publicKey(),
    signers: [signer],
  },
});
```

If the SAC already exists, deployment treats the existing contract id as a
successful outcome as long as it matches the deterministic expected id.

## Metadata Reads And Caching

`StellarAssetContract` accepts optional runtime behavior under `options`.

```ts
const sac = StellarAssetContract.fromContractId({
  networkConfig,
  contractId,
  options: {
    cache: {
      enabled: true,
      ttl: 60_000,
      cacheRejected: false,
      evictOnExpiry: false,
    },
  },
});
```

The cache policy currently applies to:

- `decimals()`
- `name()`
- `symbol()`

Example:

```ts
const decimals = await sac.decimals();
const name = await sac.name();
const symbol = await sac.symbol();
```

## Common Read Methods

```ts
const balance = await sac.balance({ id: userAddress });
const allowance = await sac.allowance({
  from: ownerAddress,
  spender: spenderAddress,
});
const isAuthorized = await sac.authorized({ id: userAddress });
const admin = await sac.admin();
```

## Common Write Methods

### Transfer

```ts
await sac.transfer({
  from: senderAddress,
  to: recipientAddress,
  amount: 100_0000000n,
  config,
});
```

### Approve

```ts
await sac.approve({
  from: ownerAddress,
  spender: spenderAddress,
  amount: 1000_0000000n,
  expirationLedger: currentLedger + 1000,
  config,
});
```

### Admin Operations

```ts
await sac.mint({
  to: recipientAddress,
  amount: 1_000_000_0000000n,
  config,
});

await sac.setAdmin({
  newAdmin: newAdminAddress,
  config,
});
```

## Advanced Usage With Plugins

SAC remains a composed high-level client. When you need pipeline-level control,
attach plugins to the owned invoke pipeline:

```ts
import { createChannelAccountsPlugin } from "@colibri/plugin-channel-accounts";

sac.contract.invokePipe.use(createChannelAccountsPlugin({ channels }));
```

## Errors

| Code      | Class                        | Description                                  |
| --------- | ---------------------------- | -------------------------------------------- |
| `SAC_001` | `MISSING_ARG`                | Required SAC argument missing                |
| `SAC_002` | `FAILED_TO_DEPLOY_CONTRACT`  | SAC deployment failed                        |
| `SAC_003` | `UNMATCHED_CONTRACT_ID`      | Network returned a different contract id     |
| `SAC_004` | `MISSING_RETURN_VALUE`       | Expected contract return value missing       |

## Notes

- `isNativeXLM()` checks whether this SAC represents the native XLM asset
- `decimals()` still reads from the contract instead of hardcoding the value,
  which keeps the client consistent with on-chain behavior
- the underlying `Contract` is exposed as `sac.contract` for advanced usage

## Next Steps

- [Contract](../contract.md) — Generic Soroban contract client
- [SEP-11](sep-11.md) — Classic asset string utilities
- [SAC Events](../../events/standardized-events/sac.md) — Event templates for
  wrapped assets
