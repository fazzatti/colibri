# Native liquidity pools

`NativeLiquidityPool` binds to Stellar's protocol-native constant-product pool
for two native SDK `Asset` objects. “Native” describes the protocol feature, not
an XLM-only pool. Issued-asset pairs are supported too.

The constructor orders the assets canonically and derives the pool ID. It does
not create accounts, establish trustlines, submit a transaction, or choose price
tolerances. Each of those actions remains explicit.

## Bind, establish a trustline, deposit, and withdraw

This Testnet example creates a demonstration asset and account before using the
pool. Install the packages from the
[installation guide](../getting-started/installation.md). Save as `pool.ts` and
run `deno run -A pool.ts`. Do not use production keys.

<!-- deno-check -->

```ts
import {
  initializeWithFriendbot,
  LocalSigner,
  NativeLiquidityPool,
  NetworkConfig,
  StellarPrice,
  type TransactionConfig,
} from "@colibri/core";
import { Asset, Operation } from "npm:@stellar/stellar-sdk";

const networkConfig = NetworkConfig.TestNet();
const issuer = LocalSigner.generateRandom();
const provider = LocalSigner.generateRandom();
const usd = new Asset("DEMOUSD", issuer.publicKey());
const xlm = Asset.native();
const pool = new NativeLiquidityPool({ assets: [usd, xlm], networkConfig });

await initializeWithFriendbot(networkConfig.friendbotUrl, issuer.publicKey(), {
  rpcUrl: networkConfig.rpcUrl,
});
await pool.transactionPipe({
  operations: [
    Operation.createAccount({
      destination: provider.publicKey(),
      startingBalance: "100",
    }),
    Operation.changeTrust({
      source: provider.publicKey(),
      asset: usd,
      limit: "1000",
    }),
    Operation.payment({
      destination: provider.publicKey(),
      asset: usd,
      amount: "100",
    }),
  ],
  config: {
    source: issuer.publicKey(),
    signers: [issuer, provider],
    fee: "100",
    timeout: 60,
  },
});

const config: TransactionConfig = {
  source: provider.publicKey(),
  signers: [provider],
  fee: "100",
  timeout: 60,
};

// A pool-share trustline is distinct from the underlying DEMOUSD trustline.
await pool.changeTrust({ config });

// Canonical A is XLM here; B is DEMOUSD. Native pool prices mean A/B.
// Ten XLM divided by twenty DEMOUSD is 0.5, not 2.
const price = StellarPrice.fromDecimal("0.5");
const deposited = await pool.deposit({
  maxAmountA: "10",
  maxAmountB: "20",
  minPrice: price,
  maxPrice: price,
  config,
});
console.log("Confirmed deposit:", deposited.hash);

const state = await pool.getState();
console.log("Canonical assets:", pool.assetA, pool.assetB);
console.log("Reserves in integer 10^-7 units:", state.reserveA, state.reserveB);
console.log("Observation ledger:", state.observedAtLedger);

// Zero minimums explicitly allow any non-negative received amounts.
// Set meaningful asset amounts when a real application needs stronger limits.
const withdrawn = await pool.withdrawByAsset({
  amount: "1",
  minimumAmounts: [{ asset: usd, amount: "0" }, { asset: xlm, amount: "0" }],
  config,
});
console.log("Confirmed withdrawal:", withdrawn.hash);
console.log(
  "Remaining shares:",
  (await pool.getTrustline(provider.publicKey())).balance,
);
```

## Amounts and price limits

Transaction amounts are decimal strings in asset units. Ledger reserve and share
balances are `bigint` quantities in 10^-7 units. An amount of `"1"` in
`withdraw` means one pool share, not one unit of either underlying asset.

`deposit` and `withdraw` preserve the native SDK inputs, apart from the pool ID
provided by the instance. `depositByAsset` and `withdrawByAsset` let callers
label amounts with their `Asset`, so callers do not have to reorder amount
arrays. Each pool asset must occur exactly once. Deposit prices still use the
native **A/B** convention, regardless of array order. Read `assetA` and `assetB`
when presenting that convention to a user.

`StellarPrice.fromDecimal` returns an exact native-compatible `{ n, d }` ratio
or rejects a value that cannot fit the protocol's signed-32-bit components. It
does not approximate a financial limit. The ordinary SDK price inputs remain
available on the native path. No convenience method selects slippage or rounds
minimum received amounts for the caller.

Minimum/maximum deposit prices bound the ratio of amounts actually deposited,
not an external market quotation. For a nonempty pool, the reserves determine
that ratio. An empty pool's first deposit establishes it. The protocol may take
less than either maximum; the submitted maximums do not promise that both full
amounts will be deposited.

## Pipeline composition and known-state reads

Each transaction method takes `config` and returns the existing confirmed
transaction outcome. An explicit `source` overrides the operation source;
otherwise it is fixed to the original `config.source` before plugins can change
the transaction source. Attach existing plugins to `pool.transactionPipe`.

`changeTrustOperation`, `depositOperation`, and `withdrawOperation` expose
native XDR operations for callers who need to batch multiple actions in their
own pipeline. `poolShareAsset` is a native SDK `LiquidityPoolAsset`; ordinary
`Operation.changeTrust` remains usable without a Colibri-specific
representation.

`getState` reads the known pool ID and returns the RPC observation ledger with
the decoded reserves and shares. `getTrustline` reads a known account's pool
share balance. Neither method discovers pools or builds a market index. State
can change before the next transaction: enforce acceptance limits in the
operation rather than treating an earlier read as a guarantee.

Errors distinguish a pool absent from a successful lookup, failed RPC retrieval,
invalid asset mappings, and rejected operation construction. See the
[pool error reference](../reference/errors/core-liquidity-pool.md).

For the protocol's behavior and failure codes, see the official
[liquidity-pool operations](https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations#liquidity-pool-deposit).
