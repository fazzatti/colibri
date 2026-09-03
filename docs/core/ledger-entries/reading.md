# Read entries and handle missing data

[Ledger Entries overview](../ledger-entries.md)

## Complete account read

Install Core, set `ACCOUNT_ID` to a Testnet G-address, and run
`deno run --allow-env --allow-net read-account.ts`. This is a read-only RPC
lookup; it does not fund the account or sign a transaction.

<!-- deno-check -->

```ts
import {
  buildAccountLedgerKey,
  LedgerEntries,
  NetworkConfig,
  StrKey,
} from "@colibri/core";

const accountId = Deno.env.get("ACCOUNT_ID") ?? "";
if (!StrKey.isValidEd25519PublicKey(accountId)) {
  console.error("Set ACCOUNT_ID to a checksummed G-address");
  Deno.exit(1);
}
const entries = new LedgerEntries({ networkConfig: NetworkConfig.TestNet() });
const account = await entries.get(buildAccountLedgerKey({ accountId }));
if (account) {
  console.log("Balance in stroops", account.balance);
} else {
  console.log("No account entry on this network");
}
```

The remaining snippets show individual lookup forms with application-supplied
IDs and keys. A syntactically valid address does not guarantee a matching entry.

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
import { Server } from "npm:@stellar/stellar-sdk/rpc";

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
import { Asset } from "npm:@stellar/stellar-sdk";

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
  buildAccountLedgerKey,
  LedgerEntries,
  NetworkConfig,
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

Use `getMany(...)` when you want to fetch multiple entries in one RPC call while
preserving input order:

```ts
import {
  buildAccountLedgerKey,
  buildConfigSettingLedgerKey,
  LedgerEntries,
  NetworkConfig,
} from "@colibri/core";

const ledger = new LedgerEntries({
  networkConfig: NetworkConfig.TestNet(),
});

const [account, configSetting] = await ledger.getMany(
  [
    buildAccountLedgerKey({ accountId: "GA..." }),
    buildConfigSettingLedgerKey({
      configSettingId: "configSettingContractMaxSizeBytes",
    }),
  ] as const,
);
```

Unlike the convenience methods, `get(...)` and `getMany(...)` return `null` when
an entry is missing instead of raising a not-found error.
