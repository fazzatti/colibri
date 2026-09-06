# Stellar assets

`StellarAsset` binds a native Stellar SDK `Asset` to a network and an existing
Colibri classic transaction pipeline. It exposes asset identity, exact amounts,
balances, holder authorization, payments, trustline limits, minting, burning,
clawback, and claimable-balance creation. Use
[StellarAssetContract](stellar-asset-contract.md) when you need the Soroban
contract interface for the same asset.

API: [StellarAsset on JSR](https://jsr.io/@colibri/core/doc/~/StellarAsset).

The implementation lives under `core/asset/native/`. Here, native means
protocol-level asset operations for both XLM and issued assets, not XLM alone.
Import `StellarAsset` from `@colibri/core`; the source directory is not a
package subpath export.

## Identity and amounts

Bind an existing SDK `Asset`, a code/issuer pair, or a SEP-11 canonical
identity. Construction performs no RPC calls. `code`, `issuer`, `symbol()`,
`decimals()`, `isNative()` and `toString()` are available immediately. The
symbol is the on-chain asset code, not an off-chain display name or a verified
issuer identity.

<!-- deno-check -->

```typescript
import {
  fromDecimals,
  LocalSigner,
  NetworkConfig,
  StellarAsset,
} from "@colibri/core";

const networkConfig = NetworkConfig.TestNet();
const issuer = LocalSigner.generateRandom();
const usd = StellarAsset.fromCanonical({
  canonical: `USD:${issuer.publicKey()}`,
  networkConfig,
});
const xlm = StellarAsset.NativeXLM({ networkConfig });

console.log(usd.toString()); // USD:G...; includes the issuer, not just the code.
console.log(xlm.toString(), xlm.issuer); // "native", undefined
console.log(usd.symbol(), usd.decimals()); // "USD", 7

const units = usd.parseAmount("12.3456789"); // 123_456_789n
console.log(usd.formatAmount(units)); // "12.3456789"
console.log(fromDecimals("0.0000001", 7)); // Existing generic converter, with explicit precision.
```

The asset methods reuse `fromDecimals` and `toDecimals`, adding the native asset
nonnegative int64 bounds. It rejects exponent notation, negative values,
overflow and fractions requiring rounding. Extra trailing decimal zeros are
harmless and accepted. Formatting produces exact decimal text. These helpers are
for native seven-decimal assets; they do not assume an arbitrary Soroban token
has the same precision.

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

// Payment from the issuing account mints units. Authorization is not required
// here because this new issuer has not enabled AUTH_REQUIRED.
const result = await usd.mint({
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
console.log(usd.formatAmount(await usd.balance({ id: holder.publicKey() })));
```

Amounts and trustline limits are decimal strings in asset units. Ledger-entry
balances and limits are `bigint` values in the protocol's seven-decimal scaled
units: `"100"` asset units is `1_000_000_000n` in a trustline read. Transaction
fees use stroops and the existing [fee configuration](../transaction-config.md).

## Explicit methods, no automatic account changes

| Method                                                  | Action                                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `getIssuer()`                                           | Reads the issuer account, including its protocol flags; returns `null` for native XLM.          |
| `getTrustline(accountId)`                               | Reads a known trustline, or returns `null` when absent. Native XLM also returns `null`.         |
| `balance({ id })`                                       | Reads the total holding in bigint smallest units. Missing holdings fail explicitly.             |
| `authorized({ id })`                                    | Reads full transfer authorization for an existing holding, not future issuer-policy guarantees. |
| `changeTrust({ limit, config })`                        | Creates or changes the source's trustline. A zero limit requests removal.                       |
| `transfer({ destination, amount, config })`             | Transfers using a native payment operation. Payments from/to the issuer mint/burn units.        |
| `mint({ destination, amount, config })`                 | Makes the asset issuer the explicit payment source, independent of the envelope source.         |
| `burn({ amount, config })`                              | Pays the asset issuer from the caller's operation source. Does not remove the trustline.        |
| `setTrustLineFlags({ trustor, flags, config })`         | Explicitly changes issuer-controlled trustline flags.                                           |
| `setAuthorized({ id, authorize, config })`              | Grants transfers or revokes them while preserving existing liabilities.                         |
| `clawback({ from, amount, config })`                    | Requests issuer clawback when the existing trustline permits it.                                |
| `createClaimableBalance({ amount, claimants, config })` | Locks this asset in a claimable balance with explicit native SDK claimants and predicates.      |

Reads take G addresses: an M address identifies the same underlying account, not
a distinct holding. For XLM, `balance` returns the native account's total
balance. It is **not spendable balance** after reserves, liabilities and fees.
For issued assets, a missing trustline raises `STAS_016`; an existing empty
trustline returns `0n`. An issuer has no finite balance of its own asset and
raises `STAS_015`, rather than returning zero or pretending to hold a trustline.
`authorized` preserves these missing/issuer-state errors. For an existing XLM
account it is true; for an issued asset it reports the trustline's full
authorization flag, not merely authorization to maintain liabilities.

Every write submits an explicit operation. No transfer creates a trustline or
authorizes a holder. Trustline removal fails if its balance or liabilities
prevent removal. Reading a trustline does not guarantee that its state will
remain unchanged until a later transaction executes.

Native XLM can be transferred but has no issuer-managed trustlines or clawback.
Trying those writes raises separate `STAS_*` errors. An issued asset named `XLM`
is still an issued asset because its identity includes the issuer.

Issuer flags remain an explicit native `Operation.setOptions` decision. The
class does not enable irreversible account-wide flags. `setTrustLineFlags`
follows SDK semantics: undefined flags are unchanged, and trustline clawback can
only be cleared, not enabled by that operation.

### Grant or revoke transfers

`setAuthorized` always uses the issuer as operation source. Granting sets full
authorization and clears the maintain-liabilities flag. Revocation changes a
fully authorized trustline to maintain-liabilities, retaining outstanding offers
and pool positions instead of deleting them. It preserves either existing
unauthorized state, rather than granting maintain-liabilities to a completely
unauthorized holder. This follows the authorization-state transitions of the
[Stellar Asset Contract](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-06.md#set_authorized),
using a native `setTrustLineFlags` operation instead of invoking Soroban.

```ts
// Fragment: usd, holder and issuerConfig are already configured.
await usd.setAuthorized({
  id: holder.publicKey(),
  authorize: true,
  config: issuerConfig,
});
await usd.setAuthorized({
  id: holder.publicKey(),
  authorize: false,
  config: issuerConfig,
});
```

Revocation reads the current trustline before building its flags. This read and
the later transaction are not atomic; concurrent issuer changes can make the
snapshot stale. Use `setTrustLineFlags` when the intended flags are already
known and should not be derived from a read. Missing revocation trustlines fail
with `STAS_022`. No operation enables `AUTH_REQUIRED` or `AUTH_REVOCABLE`;
issuer policy must already allow the requested change. For complete
deauthorization that may remove market positions, deliberately clear both
authorization flags with `setTrustLineFlags`.

### Create a claimable balance

The following complete Testnet example funds a sender and recipient, creates a
claimable XLM balance, and prints the protocol-reported ID. It does not claim it
automatically. `Claimant` and predicates remain native SDK objects.

<!-- deno-check -->

```ts
import {
  ClaimableBalancePredicates,
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
  StellarAsset,
} from "@colibri/core";
import { Claimant } from "npm:@stellar/stellar-sdk@^17.0.1";

const networkConfig = NetworkConfig.TestNet();
const sender = LocalSigner.generateRandom();
const recipient = LocalSigner.generateRandom();
for (const signer of [sender, recipient]) {
  await initializeWithFriendbot(
    networkConfig.friendbotUrl,
    signer.publicKey(),
    {
      rpcUrl: networkConfig.rpcUrl,
      allowHttp: networkConfig.allowHttp,
    },
  );
}
const xlm = StellarAsset.NativeXLM({ networkConfig });
const result = await xlm.createClaimableBalance({
  amount: "2",
  claimants: [
    new Claimant(
      recipient.publicKey(),
      ClaimableBalancePredicates.unconditional(),
    ),
  ],
  config: {
    source: sender.publicKey(),
    signers: [sender],
    fee: "100",
    timeout: 60,
  },
});
const outcome = result.operations[0];
if (outcome.type === "createClaimableBalance") {
  console.log(outcome.result.balanceId.toXdr("hex"));
}
```

For an issued asset, call the same method on its `StellarAsset` instance. The
asset is supplied by that instance; the creator and eventual claimant must meet
the protocol's balance, trustline and authorization requirements. The creating
account needs reserve for the entry unless reserve sponsorship is explicit.
Fee-bump sponsorship pays transaction fees, not that reserve. See
[claimable-balance predicates](../claimable-balance-predicates.md) for time
windows and an explicit claim operation. Invalid construction arguments raise
`STAS_023`; pipeline and on-chain failures retain their existing typed errors.

## Sources, plugins, and native interoperability

SDK-shaped writes accept the native operation's optional `source`. When omitted,
`changeTrust`, `transfer`, `burn`, and `createClaimableBalance` bind the
operation to the original `config.source`; `setTrustLineFlags` and `clawback`
bind it to the asset issuer. This happens before pipeline plugins execute.
Consequently, using a channel account for envelope sequence numbers does not
change which account the asset operation acts on.

`mint` and `setAuthorized` always bind the issuer as operation source. `burn`
always binds the issuer as destination and defaults its operation source to
`config.source`. Neither method inserts extra setup operations; both submit
ordinary SDK payments.

Constructor-time plugins follow the same pipeline-specific pattern as
`Contract`. Install `@colibri/plugin-channel-accounts` and
`@colibri/plugin-fee-bump` in addition to Core for this example. The three
signers have distinct roles: the owner authorizes the asset transfer, the
channel supplies the transaction sequence, and the fee payer signs the outer
fee-bump envelope. The example funds them through Testnet Friendbot.

<!-- deno-check -->

```ts
import {
  initializeWithFriendbot,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  StellarAsset,
} from "@colibri/core";
import { createChannelAccountsPlugin } from "@colibri/plugin-channel-accounts";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";
import { createSep29Plugin } from "@colibri/plugin-sep29";
import { Memo } from "npm:@stellar/stellar-sdk";

const networkConfig = NetworkConfig.TestNet();
const owner = LocalSigner.generateRandom();
const channel = LocalSigner.generateRandom();
const feePayer = LocalSigner.generateRandom();
for (const signer of [owner, channel, feePayer]) {
  await initializeWithFriendbot(
    networkConfig.friendbotUrl,
    signer.publicKey(),
    {
      rpcUrl: networkConfig.rpcUrl,
      allowHttp: networkConfig.allowHttp,
    },
  );
}
const xlm = StellarAsset.NativeXLM({
  networkConfig,
  plugins: {
    transactionPipe: [
      createChannelAccountsPlugin({
        channels: [NativeAccount.fromMasterSigner(channel)],
      }),
      createFeeBumpPlugin({
        networkConfig,
        feeBumpConfig: {
          source: feePayer.publicKey(),
          signers: [feePayer],
          fee: "200",
        },
      }),
      createSep29Plugin(),
    ],
  },
});

const result = await xlm.transfer({
  destination: feePayer.publicKey(),
  amount: "1",
  config: {
    source: owner.publicKey(),
    signers: [owner],
    fee: "100",
    timeout: 60,
    memo: Memo.text("asset payment"),
  },
});
console.log(result.hash);
```

Memos remain native Stellar SDK `Memo` values in `TransactionConfig`. Channel
allocation preserves the operation's owner and the memo; a fee bump preserves
them in the inner transaction. The optional SEP-29 plugin rejects a payment with
no memo when the recipient requires one; it does not invent or set the memo.
None of these plugins is installed implicitly. You may also attach them later
using `xlm.transactionPipe.use(plugin)`. Keep calling the original pipe binding;
do not replace it with the return value of `.use(...)`. Read-only methods do not
run transaction plugins.

## Explicit access to the Stellar Asset Contract

`usd.toContract()` returns a separate existing `StellarAssetContract` instance
with the deterministically derived contract ID and the same network/RPC. It does
not deploy the SAC, run simulation, or copy native transaction plugins. Store
that instance when attaching its Soroban pipeline plugins.

```typescript
// Fragment: usd, networkConfig and issuer are the bindings from the examples above.
const sac = usd.toContract();

// If the SAC does not exist, deployment is a separate deliberate transaction.
// Import StellarAssetContract from @colibri/core for this deployment path.
await StellarAssetContract.deploy({
  asset: usd.asset,
  networkConfig,
  config: {
    source: issuer.publicKey(),
    signers: [issuer],
    fee: "100",
    timeout: 60,
  },
});
const contractBalance = await sac.balance({ id: holder.publicKey() });
```

For a G holder with a trustline, the deployed SAC accesses the same native
holding. Contract-account balances, allowances, `transferFrom` and other Soroban
methods belong to the SAC API. Native `StellarAsset` methods never switch routes
automatically. Native payments use decimal amounts; SAC methods use bigint
smallest units. Soroban transactions do not support native transaction memos, so
do not blindly reuse a payment config containing one for SAC deployment.

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
