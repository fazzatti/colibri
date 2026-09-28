# Stellar Asset Contract

`StellarAssetContract` is Colibri's high-level client for Stellar Asset
Contracts (SACs), the built-in Soroban contracts that bridge classic Stellar
assets into the Soroban ecosystem.

SACs implement the token interface used by Stellar's built-in asset wrapper and
are defined in
[CAP-0046-06](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-06.md).

## Overview

Every SAC client has a contract id, a public readonly `code`, and a public
readonly `issuer`. The issuer is the original Classic asset issuer; native XLM
uses `code: "XLM"` and the `issuer: "native"` marker because it has no issuer.
The mutable value returned by [admin()](#common-read-methods) is separate.

You can create that client from:

- a known `contractId`, resolved asynchronously through RPC
- a [Classic asset identity](stellar-asset.md) (`code` + `issuer`),
  synchronously
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

Await `fromContractId` to resolve the underlying
[Classic asset](stellar-asset.md) through the RPC in
[NetworkConfig](../network.md), or supply your own
[native RPC client](../../getting-started/compatibility.md#supported-and-tested-integrations). It makes one
[contract-instance ledger read](../ledger-entries/contracts.md), requires the
built-in Stellar Asset executable, reads the canonical `METADATA.name`, and
verifies that the [SEP-11 asset identity](sep-11.md) derives the supplied
contract id on that network. It does not simulate, submit, deploy or restore.

<!-- deno-check -->

```ts
import { NetworkConfig, StellarAssetContract } from "@colibri/core";

const sac = await StellarAssetContract.fromContractId({
  networkConfig: NetworkConfig.TestNet(),
  contractId: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
});

console.log(sac.code); // USDC
console.log(sac.issuer); // GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5
```

Identity is complete when the promise resolves. Missing/archived entries and RPC
failures reject with the underlying error; custom Wasm/external-reference
contracts, malformed metadata and mismatched identities are rejected with
[SAC errors](../../reference/errors/core-asset-sac.md). Use
[SEP41TokenContract](sep-41-token-contract.md) for arbitrary SEP-41 contracts.
The factory does not accept caller-supplied identity overrides; use
[fromAsset](#from-a-classic-asset) when the identity is already known.

### Native XLM

```ts
const sac = StellarAssetContract.NativeXLM({
  networkConfig: NetworkConfig.TestNet(),
});
```

### Constructor Form

The constructor requires a complete [Classic asset](stellar-asset.md) identity
and derives its contract id locally. Like [fromAsset](#from-a-classic-asset) and
[NativeXLM](#native-xlm), this is synchronous and does not verify that the SAC
has been deployed. Use [fromContractId](#from-a-known-contract-id) when only its
address is known:

```ts
const sac = new StellarAssetContract({
  networkConfig: NetworkConfig.TestNet(),
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
});
```

### Migrating From Core 1.x

[Core 2.0](../../getting-started/compatibility.md#core-20-sac-identity-migration)
changes `fromContractId` to return a promise. Add `await` before using the
client or attaching plugins. Replace
`new StellarAssetContract({ contractId, ... })` with
`await StellarAssetContract.fromContractId({ contractId, ... })`. Factories
supplied with complete asset identity stay synchronous. Read `code` and `issuer`
directly after construction; neither field is optional.

## Deploying A SAC

The deployment flow is a static factory that returns a ready client:

```ts
import {
  LocalSigner,
  NetworkConfig,
  StellarAssetContract,
} from "@colibri/core";

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
const sac = await StellarAssetContract.fromContractId({
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

Write methods below accept [TransactionConfig](../transaction-config.md). Its
[resource controls](../resources.md) apply to Soroban invocations;
[trustline changes](stellar-asset.md) use classic transactions.

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

### Trust

Create an unlimited trustline for this asset on a classic Stellar account:

```ts
await sac.trust({
  address: holderAddress,
  config,
});
```

Use this before sending the asset to a classic account that does not already
trust it. Existing trustlines are unchanged, and contract addresses are ignored.

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
attach plugins to the owned [invoke pipeline](../pipelines/invoke-contract.md):

```ts
import { createChannelAccountsPlugin } from "@colibri/plugin-channel-accounts";

sac.contract.invokePipe.use(createChannelAccountsPlugin({ channels }));
```

## Errors

See [every code for this context](../../reference/errors/core-asset-sac.md) and
the [error-handling guide](../../core/error.md). Failures from lower-level
processes can retain their original context and code.

## Notes

- `isNativeXLM()` checks whether this SAC represents the native XLM asset
- `decimals()` still reads from the contract instead of hardcoding the value,
  which keeps the client consistent with on-chain behavior
- the underlying [`Contract`](../contract.md) is exposed as `sac.contract` for
  advanced usage

## Next Steps

- [Contract](../contract.md) — Generic Soroban contract client
- [SEP-11](sep-11.md) — Classic asset string utilities
- [SAC Events](../../events/standardized-events/sac.md) — Event templates for
  wrapped assets
