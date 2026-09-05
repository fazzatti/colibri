# Stellar asset account operations

`StellarAsset` binds a native Stellar SDK `Asset` to a network and an existing
Colibri classic transaction pipeline. Use it for asset payments, trustline
limits, issuer authorization, and clawback. Use
[StellarAssetContract](stellar-asset-contract.md) when you need the Soroban
contract interface for the same asset.

API: [StellarAsset on JSR](https://jsr.io/@colibri/core/doc/~/StellarAsset).

## Create a trustline and receive an issued asset

Install `@colibri/core` and `@stellar/stellar-sdk` using the
[installation guide](../../getting-started/installation.md). Save the following
as `asset.ts` and run `deno run -A asset.ts`. It creates disposable Testnet
accounts and uses Friendbot; do not substitute production accounts or Mainnet
credentials.

<!-- deno-check -->

```typescript
import {
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
  StellarAsset,
} from "@colibri/core";
import { Asset } from "npm:@stellar/stellar-sdk@^17.0.1";

const networkConfig = NetworkConfig.TestNet();
const issuer = LocalSigner.generateRandom();
const holder = LocalSigner.generateRandom();

for (const signer of [issuer, holder]) {
  await initializeWithFriendbot(
    networkConfig.friendbotUrl,
    signer.publicKey(),
    { rpcUrl: networkConfig.rpcUrl, allowHttp: networkConfig.allowHttp },
  );
}

// The original Asset remains a normal Stellar SDK object.
const usd = new StellarAsset({
  asset: new Asset("USD", issuer.publicKey()),
  networkConfig,
});

// This method executes one changeTrust operation and waits for confirmation.
await usd.changeTrust({
  limit: "1000",
  config: {
    source: holder.publicKey(),
    signers: [holder],
    fee: "100",
    timeout: 60,
  },
});

// Payment from the issuing account issues units. Authorization is not required
// here because this new issuer has not enabled AUTH_REQUIRED.
const result = await usd.transfer({
  destination: holder.publicKey(),
  amount: "100",
  config: {
    source: issuer.publicKey(),
    signers: [issuer],
    fee: "100",
    timeout: 60,
  },
});

console.log(result.hash, result.operations);
console.log(await usd.getTrustline(holder.publicKey()));
```

Amounts and trustline limits are decimal strings in asset units. Ledger-entry
balances and limits are `bigint` values in the protocol's seven-decimal scaled
units: `"100"` asset units is `1_000_000_000n` in a trustline read. Transaction
fees use stroops and the existing [fee configuration](../transaction-config.md).

## Explicit methods, no automatic account changes

| Method                                          | Action                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `getIssuer()`                                   | Reads the issuer account, including its protocol flags; returns `null` for native XLM.      |
| `getTrustline(accountId)`                       | Reads a known trustline, or returns `null` when absent. Native XLM also returns `null`.     |
| `changeTrust({ limit, config })`                | Creates or changes the source's trustline. A zero limit requests removal.                   |
| `transfer({ destination, amount, config })`     | Transfers using a native payment operation. Payments from/to the issuer issue/redeem units. |
| `setTrustLineFlags({ trustor, flags, config })` | Explicitly changes issuer-controlled trustline flags.                                       |
| `clawback({ from, amount, config })`            | Requests issuer clawback when the existing trustline permits it.                            |

No write performs a preliminary read or silently skips an operation. No transfer
creates a trustline or authorizes a holder. Trustline removal fails if its
balance or liabilities prevent removal. Reading a trustline does not guarantee
that its state will remain unchanged until a later transaction executes.

Native XLM can be transferred but has no issuer-managed trustlines or clawback.
Trying those writes raises separate `STAS_*` errors. An issued asset named `XLM`
is still an issued asset because its identity includes the issuer.

Issuer flags remain an explicit native `Operation.setOptions` decision. The
class does not enable irreversible account-wide flags. `setTrustLineFlags`
follows SDK semantics: undefined flags are unchanged, and trustline clawback can
only be cleared, not enabled by that operation.

## Sources, plugins, and native interoperability

Each write accepts the native operation's optional `source`. When omitted,
`changeTrust` and `transfer` bind the operation to the original `config.source`;
`setTrustLineFlags` and `clawback` bind it to the asset issuer. This happens
before pipeline plugins execute. Consequently, using a channel account for
envelope sequence numbers does not change which account the asset operation acts
on.

Include signers for both the envelope source and every different operation
source. G and M sources follow the underlying Stellar operation rules. Trustline
retrieval uses a G account ID because muxed IDs do not identify separate
trustline entries.

`transactionPipe` is the existing callable `ClassicTransactionPipeline`, not a
new transaction route. Attach compatible plugins using
`asset.transactionPipe.use(...)`. For sponsored or multi-operation workflows,
call that pipe directly with native SDK operations, including `asset.asset`
wherever the SDK accepts an `Asset`.

You may construct the instance using `{ code, issuer, networkConfig }` instead
of `{ asset, networkConfig }`. The combination
`{ code: "XLM", issuer: "native" }` selects native XLM. Other codes paired with
`"native"` are rejected rather than silently reinterpreted as XLM. An optional
native SDK `rpc` server is shared by reads and the transaction pipe; otherwise
the server is constructed from `networkConfig`.

The class owns no persistent connection or account lifecycle requiring disposal.
Keep test credentials private and explicitly redeem balances and remove
trustlines when your application needs that cleanup; it is not automatic.

## Results and failures

Writes return the same
[confirmed runtime outcomes](../processes/parse-classic-transaction-outcome.md)
as the classic transaction pipeline: hash, ledger, charged fee, native RPC
response, and ordered operation results. SDK argument-construction failures use
occurrence-specific `STAS_*` errors. Native RPC transport failures use separate
issuer-read and trustline-read `STAS_*` errors retaining the original cause.
Existing typed pipeline and ledger-reader errors retain their own namespaces.
Confirmation does not imply that another account's issuer policy can never
change afterward.
