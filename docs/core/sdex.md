# Stellar exchange offers

`SDEX` creates, updates, reads, and cancels known offers through Stellar RPC and
Colibri's existing transaction pipeline. It accepts native Stellar SDK `Asset`
objects and returns the pipeline's confirmed, runtime-typed operation outcomes.
It does not require a separate order representation.

Install `@colibri/core` and `@stellar/stellar-sdk` using the
[installation guide](../getting-started/installation.md).

## Sell an asset, inspect the result, and cancel its remainder

Save this complete example as `offer.ts` and run `deno run -A offer.ts`. It uses
Testnet, creates disposable accounts, and issues its own demonstration asset.
Never substitute production keys into a learning example. A resting offer locks
selling liabilities and consumes an account subentry reserve until it is filled
or cancelled. Transaction fees are separate from the exchange price.

<!-- deno-check -->

```ts
import {
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
  SDEX,
  StellarPrice,
  type TransactionConfig,
} from "@colibri/core";
import { Asset, Operation } from "npm:@stellar/stellar-sdk";

const networkConfig = NetworkConfig.TestNet();
const issuer = LocalSigner.generateRandom();
const seller = LocalSigner.generateRandom();
await initializeWithFriendbot(
  networkConfig.friendbotUrl,
  issuer.publicKey(),
  { rpcUrl: networkConfig.rpcUrl },
);

const sdex = new SDEX({ networkConfig });
const usd = new Asset("DEMOUSD", issuer.publicKey());
const xlm = Asset.native();

// Account creation, trustline establishment and issuance are explicit actions.
// SDEX never inserts any of these as a side effect of placing an offer.
await sdex.transactionPipe({
  operations: [
    Operation.createAccount({
      destination: seller.publicKey(),
      startingBalance: "100",
    }),
    Operation.changeTrust({
      source: seller.publicKey(),
      asset: usd,
      limit: "1000",
    }),
    Operation.payment({
      destination: seller.publicKey(),
      asset: usd,
      amount: "100",
    }),
  ],
  config: {
    source: issuer.publicKey(),
    signers: [issuer, seller],
    fee: "100",
    timeout: 60,
  },
});

const config: TransactionConfig = {
  source: seller.publicKey(),
  signers: [seller],
  fee: "100",
  timeout: 60,
};

console.log(StellarPrice.describe({
  price: StellarPrice.fromDecimal("2"),
  baseAsset: usd,
  quoteAsset: xlm,
}));

// Offer up to 10 DEMOUSD for at least 2 XLM per DEMOUSD. This is a limit
// offer, not a guaranteed swap. It can fill fully, partly, or not at all.
const result = await sdex.sell({
  asset: usd,
  amount: "10",
  receive: xlm,
  minimumReceivePerUnit: "2",
  config,
});

console.log("Confirmed transaction:", result.hash);
const outcome = result.operations[0];
if (outcome.type === "manageSellOffer") {
  const { offersClaimed, offer } = outcome.result.success;
  console.log("Protocol-reported liquidity claims:", offersClaimed);
  console.log("Offer effect:", offer.type);

  if (offer.type === "manageOfferCreated") {
    const offerId = String(offer.offer.offerId);
    const current = await sdex.getOffer({
      seller: seller.publicKey(),
      offerId,
    });
    console.log("Remaining live offer:", current);

    if (current) {
      // This convenience performs a fresh known-key read, then submits the
      // native zero-amount cancellation with the seller as operation source.
      await sdex.cancelOffer({ seller: seller.publicKey(), offerId, config });
    }
  }
}
```

The example leaves its disposable account and trustline on Testnet; it cancels
the offer remainder when one is observed. A concurrent fill can still remove the
offer between the read and cancellation. Treat that as changed ledger state, not
as an instruction to recreate the offer. Claim records remain native SDK XDR
objects: they may describe an order-book offer or pool liquidity.

## Native SDK price conventions and plain-language alternatives

Each operation method accepts the SDK's normal price input, including native
`{ n, d }` ratios and its supported decimal input. The following fragments
assume the initialized `sdex`, `usd`, `xlm`, and `config` from the example
above. They show alternatives: do not execute both unless you intend to place
two offers.

```ts
// Native sell convention: units of buying per one unit of selling.
await sdex.createSellOffer({
  selling: usd,
  buying: xlm,
  amount: "10",
  price: { n: 5, d: 4 },
  config,
});

// Same intent, with explicit names and an exact decimal limit.
await sdex.sell({
  asset: usd,
  receive: xlm,
  amount: "10",
  minimumReceivePerUnit: "1.25",
  config,
});

// Native buy convention: units of selling per one unit of buying.
await sdex.createBuyOffer({
  selling: xlm,
  buying: usd,
  buyAmount: "10",
  price: { n: 5, d: 4 },
  config,
});

await sdex.buy({
  asset: usd,
  payWith: xlm,
  amount: "10",
  maximumSpendPerUnit: "1.25",
  config,
});
```

The buy example requests up to 10 DEMOUSD for at most 1.25 XLM per DEMOUSD.
Stellar stores ledger offer prices as buying-per-selling, so a buy operation's
submitted price is the inverse of the stored offer price. `getOffer()` preserves
that ledger convention; it does not silently relabel or invert its result.

`StellarPrice.fromDecimal` reduces with integer arithmetic and rejects a decimal
that cannot be represented exactly with positive int32 numerator and
denominator. For example, `1.25` becomes `5/4`, but `0.0000000001` is rejected
instead of rounded. Decimal syntax is unsigned plain text (`"0.25"`, not
`"2.5e-1"`). The native SDK-shaped methods retain the SDK's own input and
approximation behavior; choose an explicit fraction when exactness matters.

`StellarPrice.invert` reverses a ratio. `StellarPrice.format` uses exact decimal
text for terminating fractions and reduced fraction text for repeating ones:
`{ n: 1, d: 3 }` formats as `"1/3"`, never `"0.3333"`. `describe` requires
explicit base/quote assets and includes the issuer of issued assets, so two
currencies sharing a code are not confused. No percentage tolerance, reference
market price, or exchange-rate policy is selected automatically.

For an exchange stated as quantities, use `StellarPrice.fromAmounts`:

```typescript
// Two quote units for three base units. No repeating decimal needs to be typed.
const price = StellarPrice.fromAmounts({ baseAmount: "3", quoteAmount: "2" });
console.log(price); // { n: 2, d: 3 }
console.log(StellarPrice.format(price)); // "2/3"
console.log(StellarPrice.compare(price, { n: 1, d: 1 })); // -1
```

Both quantities must be positive native decimal amounts. The ratio is reduced
before int32 range validation. `compare` uses exact bigint cross-products and
returns -1, 0, or 1, including when floating-point multiplication would lose
precision. These tools do not fetch a market price or infer which asset should
be base or quote.

## Updates, passive offers, sources and plugins

- `updateSellOffer` requires a positive existing `offerId` and accepts the
  native sell fields. `updateBuyOffer` uses `buyAmount` and the native buy
  convention. These methods reject ID zero rather than silently placing a new
  offer.
- Zero `amount` or `buyAmount` retains the native cancellation behavior.
- `updateSell` and `updateBuy` use the same plain-language fields and units as
  `sell` and `buy`, plus an explicit positive `offerId`. They do not read and
  preserve a stale remaining amount on your behalf.
- `createPassiveSellOffer` does not consume a counter-offer at exactly the same
  price. Better-priced liquidity can still trade. Update or cancel it using its
  ordinary known offer ID.
- `passiveSell` supplies the same plain-language fields as `sell` for the
  passive operation. Passive does not mean unfillable; better prices can trade.
- `source`, when provided to an operation method, is independent from
  `config.source`. When omitted, it is set to the original `config.source`
  before plugins run, so channel allocation cannot change the offer owner.
  Include the necessary signer for every source. `cancelOffer` explicitly uses
  its `seller` as the operation source.
- `transactionPipe` is the existing callable classic transaction pipeline.
  Attach plugins to this original binding with
  `sdex.transactionPipe.use(plugin)`; subsequent class writes use it. Do not
  replace it with the return from `.use`.
- Reads use the configured RPC server; they do not submit transactions or pass
  through write-pipeline plugins. Constructor `rpc` accepts a native SDK server.

## Results, errors and scope

Every write returns the full confirmed transaction result, including ordered
`operations`, `feeCharged`, and the native RPC response. A successful operation
can consume existing liquidity and leave no offer at all. Check the actual
`manageOfferCreated`, `manageOfferUpdated`, or `manageOfferDeleted` effect
instead of assuming a create method must yield an ID.

`getOffer({ seller, offerId })` returns a decoded ledger entry or `null` when
the known key is absent. Like the other asynchronous reads, validation and
transport failures reject its promise. Use string or bigint IDs for large
values; unsafe numeric IDs are rejected with `SDEX_009` before RPC access rather
than rounded. Cancellation of an absent offer reports `SDEX_006`. A native RPC
transport failure reports `SDEX_010`, retaining its original cause; it is never
interpreted as an absent offer. Construction failures have distinct `SDEXErrors`
codes and preserve native SDK causes; ledger-read and pipeline failures retain
their existing Colibri codes. Exact-price input failures use
`StellarPriceErrors`.

There is no account-offer listing, full order book, history, best-price routing,
or path discovery in this class. RPC known-key reads are not a market indexer.
Callers remain responsible for accounts, balances, trustlines, issuer approvals,
reserves, and the choice of financial limits.

[SDEX API reference](https://jsr.io/@colibri/core/doc/~/SDEX) ·
[StellarPrice API reference](https://jsr.io/@colibri/core/doc/~/StellarPrice) ·
[Transaction outcomes](pipelines/classic-transaction.md)

Constructor `plugins: { transactionPipe: [plugin] }` installs the same plugins
on `sdex.transactionPipe` before the first write, as with `StellarAsset`. Memos
belong in each write's `config.memo`; channel and fee-bump plugins retain native
operation sources. See the
[complete asset plugin example](asset/stellar-asset.md#sources-plugins-and-native-interoperability).
