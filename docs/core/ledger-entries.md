# Ledger Entries

`LedgerEntries` is Colibri's high-level RPC helper for reading live Stellar
ledger state without manually assembling `LedgerKey` XDR or walking raw entry
XDR responses yourself.

It is designed for two kinds of usage:

- **simple typed reads** for well-known entry kinds such as accounts,
  trustlines, offers, and contract entries
- **lower-level key-based reads** when you want to build ledger keys yourself
  and still get typed decoding

## Creating A Reader

You can bind `LedgerEntries` to either a `NetworkConfig` or an existing RPC
instance:

```ts
import { LedgerEntries, NetworkConfig } from "@colibri/core";

const networkConfig = NetworkConfig.TestNet();

const ledger = new LedgerEntries({ networkConfig });
```

```ts
import { LedgerEntries, NetworkConfig } from "@colibri/core";
import { Server } from "stellar-sdk/rpc";

const networkConfig = NetworkConfig.TestNet();
const rpc = new Server(networkConfig.rpcUrl!, {
  allowHttp: networkConfig.allowHttp ?? false,
});

const ledger = new LedgerEntries({ rpc });
```

## Convenience Reads

`LedgerEntries` exposes direct helpers for the common well-known entry types:

- `account(...)`
- `trustline(...)`
- `offer(...)`
- `data(...)`
- `claimableBalance(...)`
- `liquidityPool(...)`
- `contractData(...)`
- `contractInstance(...)`
- `contractCode(...)`
- `configSetting(...)`

Example:

```ts
import { LedgerEntries, NetworkConfig } from "@colibri/core";
import { Asset } from "stellar-sdk";

const networkConfig = NetworkConfig.TestNet();
const ledger = new LedgerEntries({ networkConfig });

const account = await ledger.account({
  accountId: "GA...",
});

const trustline = await ledger.trustline({
  accountId: "GA...",
  asset: new Asset("USDC", "GB..."),
});

console.log(account.balance);
console.log(trustline.limit);
console.log(trustline.flags.authorized);
```

These convenience methods are the right choice when you know the entry kind in
advance and want a typed result immediately.

If the requested entry does not exist, these convenience methods raise typed
ledger-entry errors instead of returning `null`.

## The Returned Shape

Each decoded result includes friendly fields for the entry type plus an `xdr`
property for advanced inspection.

```ts
const instance = await ledger.contractInstance({
  contractId: "CA...",
});

console.log(instance.type); // "contractInstance"
console.log(instance.executable);
console.log(instance.xdr); // parsed RPC entry payload
```

This keeps the simple path ergonomic without hiding the original parsed RPC
entry from advanced callers.

## Generic Reads

Use `get(...)` when you already have a ledger key and want a nullable typed
lookup:

```ts
import {
  LedgerEntries,
  NetworkConfig,
  buildAccountLedgerKey,
} from "@colibri/core";

const ledger = new LedgerEntries({
  networkConfig: NetworkConfig.TestNet(),
});

const entry = await ledger.get(
  buildAccountLedgerKey({ accountId: "GA..." }),
);

if (entry) {
  console.log(entry.balance);
}
```

Use `getMany(...)` when you want to fetch multiple entries in one RPC call
while preserving input order:

```ts
import {
  LedgerEntries,
  NetworkConfig,
  buildAccountLedgerKey,
  buildConfigSettingLedgerKey,
} from "@colibri/core";

const ledger = new LedgerEntries({
  networkConfig: NetworkConfig.TestNet(),
});

const [account, configSetting] = await ledger.getMany([
  buildAccountLedgerKey({ accountId: "GA..." }),
  buildConfigSettingLedgerKey({
    configSettingId: "configSettingContractMaxSizeBytes",
  }),
] as const);
```

Unlike the convenience methods, `get(...)` and `getMany(...)` return `null`
when an entry is missing instead of raising a not-found error.

## Ledger Key Builders

The ledger-entry module also exports granular key builders so advanced callers
can work directly with `xdr.LedgerKey` values:

- `buildAccountLedgerKey(...)`
- `buildTrustlineLedgerKey(...)`
- `buildOfferLedgerKey(...)`
- `buildDataLedgerKey(...)`
- `buildClaimableBalanceLedgerKey(...)`
- `buildLiquidityPoolLedgerKey(...)`
- `buildContractDataLedgerKey(...)`
- `buildContractInstanceLedgerKey(...)`
- `buildContractCodeLedgerKey(...)`
- `buildConfigSettingLedgerKey(...)`
- `buildTtlLedgerKey(...)`
- `hashLedgerKey(...)`

These builders return plain `xdr.LedgerKey` objects at runtime, but Colibri
brands them at the type level so `get(...)` and `getMany(...)` can preserve the
expected entry type when you use the exported builders.

## Contract Data Notes

Classic Stellar entry kinds have well-defined decoded shapes. Contract storage
does not.

That means `contractData(...)` gives you a friendly wrapper around the entry,
but it does **not** try to infer a contract-specific application schema.
Instead, it gives you access to the parsed key/value forms so you can decode
them according to your own contract conventions.

```ts
import { LedgerEntries, NetworkConfig } from "@colibri/core";
import { xdr } from "stellar-sdk";

const ledger = new LedgerEntries({
  networkConfig: NetworkConfig.TestNet(),
});

const data = await ledger.contractData({
  contractId: "CA...",
  key: xdr.ScVal.scvSymbol("counter"),
});

console.log(data.key);
console.log(data.value);
```

## Contract Code Lookup

`contractCode(...)` supports two lookup styles:

- by explicit wasm hash
- by `contractId`, resolving the contract instance first

```ts
const code = await ledger.contractCode({
  contractId: "CA...",
});

console.log(code.hash);
console.log(code.code.length);
```

## TTL Keys

The module can build TTL keys and TTL key hashes:

```ts
import {
  buildContractInstanceLedgerKey,
  buildTtlLedgerKey,
  hashLedgerKey,
} from "@colibri/core";

const contractKey = buildContractInstanceLedgerKey({
  contractId: "CA...",
});

const ttlKey = buildTtlLedgerKey({ key: contractKey });
const keyHash = hashLedgerKey(contractKey);
```

However, direct TTL reads are not exposed through `LedgerEntries` because the
shared RPC ledger-entry read path does not support them cleanly today.

## Next Steps

- [Contract](contract.md) — High-level Soroban client
- [Network](network.md) — Network configuration
- [Stellar Asset Contract](asset/stellar-asset-contract.md) — SAC-specific
  client
