import {
  assert,
  assertEquals,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Asset,
  getLiquidityPoolId,
  LiquidityPoolAsset,
  LiquidityPoolId,
  Operation,
} from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { NativeLiquidityPool } from "@/liquidity-pool/index.ts";
import * as E from "@/liquidity-pool/error.ts";
import { NetworkConfig } from "@/network/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { StrKey } from "@/strkeys/index.ts";
import { buildTrustlineLedgerKey } from "@/ledger-entries/index.ts";
import { INVALID_ACCOUNT_ID } from "@/ledger-entries/error.ts";
import { BASE_FEE_TOO_LOW_ERROR } from "@/processes/build-transaction/error.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { PoolDepositByAssetArgs } from "@/liquidity-pool/types.ts";

describe("NativeLiquidityPool", () => {
  const signer = LocalSigner.generateRandom();
  const other = LocalSigner.generateRandom();
  const xlm = Asset.native();
  const usd = new Asset("USD", signer.publicKey());
  const networkConfig = NetworkConfig.TestNet();
  const pool = new NativeLiquidityPool({ assets: [usd, xlm], networkConfig });
  const config: TransactionConfig = {
    source: signer.publicKey(),
    signers: [signer],
    fee: "0",
    timeout: 60,
  };
  const deposit = {
    maxAmountA: "10",
    maxAmountB: "20",
    minPrice: { n: 1, d: 2 },
    maxPrice: { n: 1, d: 2 },
  };
  const withdrawal = { amount: "1", minAmountA: "0", minAmountB: "0" };

  it("converts explicitly labelled price intervals including reciprocal endpoint reversal", () => {
    assertEquals(
      pool.priceBounds({
        baseAsset: xlm,
        quoteAsset: usd,
        minimum: "2",
        maximum: "4",
      }),
      { minPrice: { n: 1, d: 4 }, maxPrice: { n: 1, d: 2 } },
    );
    const minimum = Object.freeze({ n: 1, d: 4 });
    const maximum = Object.freeze({ n: 1, d: 2 });
    const bounds = pool.priceBounds({
      baseAsset: usd,
      quoteAsset: xlm,
      minimum,
      maximum,
    });
    assertEquals(bounds, { minPrice: minimum, maxPrice: maximum });
    assert(bounds.minPrice !== minimum);
    assertEquals(
      pool.priceBounds({
        baseAsset: usd,
        quoteAsset: xlm,
        minimum: "0.5",
        maximum: "0.5",
      }),
      { minPrice: { n: 1, d: 2 }, maxPrice: { n: 1, d: 2 } },
    );
    for (
      const [baseAsset, quoteAsset] of [[xlm, xlm], [usd, usd], [
        xlm,
        new Asset("USD", other.publicKey()),
      ]]
    ) {
      assertThrows(
        () =>
          pool.priceBounds({
            baseAsset,
            quoteAsset,
            minimum: "1",
            maximum: "2",
          }),
        E.INVALID_PRICE_ASSETS,
      );
    }
    assertThrows(
      () =>
        pool.priceBounds({
          baseAsset: xlm,
          quoteAsset: usd,
          minimum: "4",
          maximum: "2",
        }),
      E.REVERSED_PRICE_BOUNDS,
    );
  });

  it("keeps position transport failures identified without swallowing key validation", async () => {
    const unavailable = new NativeLiquidityPool({
      assets: [xlm, usd],
      networkConfig,
      rpc: new Server("http://127.0.0.1:0", { allowHttp: true }),
    });
    const error = await assertRejects(
      () => unavailable.getPosition(signer.publicKey()),
      E.FAILED_TO_READ_POSITION,
    );
    assert(error.meta?.cause instanceof Error);
    await assertRejects(
      () => unavailable.getPosition("Ginvalid"),
      INVALID_ACCOUNT_ID,
    );
  });

  it("canonicalizes assets and uses the exact native SDK pool identity", () => {
    const native = new LiquidityPoolAsset(xlm, usd, 30);
    const bytes = getLiquidityPoolId(
      "constant_product",
      native.getLiquidityPoolParameters(),
    );
    assertEquals(pool.poolId, StrKey.encodeLiquidityPool(bytes));
    assert(pool.assetA.equals(xlm));
    assert(pool.assetB.equals(usd));
    assert(pool.poolShareAsset.equals(native));
    assertEquals(
      new NativeLiquidityPool({ assets: [xlm, usd], networkConfig }).poolId,
      pool.poolId,
    );
    assertEquals(typeof pool.transactionPipe, "function");
    assertStrictEquals(pool.networkConfig, networkConfig);
    const rpc = new Server(networkConfig.rpcUrl!);
    const binding = new NativeLiquidityPool({
      assets: [xlm, usd],
      networkConfig,
      rpc,
    });
    assertStrictEquals(binding.rpc, rpc);
    assertStrictEquals(binding.ledgerEntries.rpc, rpc);
    const local = new NativeLiquidityPool({
      assets: [xlm, usd],
      networkConfig: NetworkConfig.CustomNet({
        networkPassphrase: "local",
        rpcUrl: "http://localhost:8000",
        allowHttp: true,
      }),
    });
    assertEquals(local.rpc.serverURL.toString(), "http://localhost:8000/");
  });

  it("does not let mutable native asset instances change the bound pool identity", () => {
    const mutable = new Asset("USD", signer.publicKey());
    const binding = new NativeLiquidityPool({
      assets: [mutable, xlm],
      networkConfig,
    });
    Object.assign(mutable, { code: "EUR" });
    Object.assign(binding.assetB, { code: "GBP" });
    Object.assign(binding.poolShareAsset.assetB, { code: "CAD" });
    assertEquals(binding.assetB.code, "USD");
    assertEquals(binding.poolId, pool.poolId);
  });

  it("distinguishes invalid assets and unavailable RPC configuration", () => {
    assertThrows(
      () => new NativeLiquidityPool({ assets: [xlm, xlm], networkConfig }),
      E.INVALID_ASSET_PAIR,
    );
    assertThrows(
      () =>
        new NativeLiquidityPool({
          assets: [xlm, usd],
          networkConfig: NetworkConfig.TestNet({
            rpcUrl: "http://localhost:8000",
          }),
        }),
      E.FAILED_TO_CREATE_RPC,
    );
    assertThrows(
      () =>
        new NativeLiquidityPool({
          assets: [xlm, usd],
          networkConfig: NetworkConfig.CustomNet({
            networkPassphrase: "local",
          }),
        }),
      E.FAILED_TO_CREATE_RPC,
    );
  });

  it("builds ordinary native operations, preserving the A/B price direction and caller source", () => {
    const share = pool.poolShareAsset;
    const hex = share.toString().split(":")[1];
    assertEquals(
      pool.changeTrustOperation({ limit: "12", source: signer.publicKey() })
        .toXdr("base64"),
      Operation.changeTrust({
        asset: share,
        limit: "12",
        source: signer.publicKey(),
      }).toXdr("base64"),
    );
    assertEquals(
      pool.depositOperation(deposit).toXdr("base64"),
      Operation.liquidityPoolDeposit({ liquidityPoolId: hex, ...deposit })
        .toXdr("base64"),
    );
    assertEquals(
      pool.withdrawOperation(withdrawal).toXdr("base64"),
      Operation.liquidityPoolWithdraw({ liquidityPoolId: hex, ...withdrawal })
        .toXdr("base64"),
    );
    const key = buildTrustlineLedgerKey({
      accountId: signer.publicKey(),
      asset: new LiquidityPoolId(hex),
    });
    assertEquals(key.trustLine.asset.type, "assetTypePoolShare");
    if (key.trustLine.asset.type === "assetTypePoolShare") {
      assertEquals(
        StrKey.encodeLiquidityPool(
          key.trustLine.asset.liquidityPoolId.toBytes(),
        ),
        pool.poolId,
      );
    }
  });

  it("wraps every native SDK construction failure in its own Colibri error", () => {
    const errors = [
      assertThrows(
        () => pool.changeTrustOperation({ limit: "-1" }),
        E.FAILED_TO_BUILD_TRUSTLINE,
      ),
      assertThrows(
        () => pool.depositOperation({ ...deposit, maxAmountA: "-1" }),
        E.FAILED_TO_BUILD_DEPOSIT,
      ),
      assertThrows(
        () => pool.withdrawOperation({ ...withdrawal, amount: "-1" }),
        E.FAILED_TO_BUILD_WITHDRAWAL,
      ),
    ];
    for (const error of errors) assert(error.meta?.cause instanceof Error);
  });

  it("executes the real pipeline without changing operation sources", async () => {
    for (const source of [undefined, other.publicKey()]) {
      const calls = [
        () => pool.changeTrust({ config, source }),
        () => pool.deposit({ ...deposit, config, source }),
        () => pool.withdraw({ ...withdrawal, config, source }),
      ];
      for (const invoke of calls) {
        // Real fee validation occurs before RPC. No stubbed pipeline is needed.
        const error = await assertRejects(invoke, BASE_FEE_TOO_LOW_ERROR);
        const operation = Operation.fromXdrObject(
          error.meta.data.input.operations[0],
        );
        assertEquals(operation.source, source ?? signer.publicKey());
        assertEquals(error.meta.data.input.source, config.source);
      }
    }
    await assertRejects(
      () => pool.getTrustline("Ginvalid"),
      INVALID_ACCOUNT_ID,
    );
  });

  it("maps asset-labelled amounts in either order, without choosing limits", async () => {
    const depositError = await assertRejects(
      () =>
        pool.depositByAsset({
          config,
          maximumAmounts: [{ asset: usd, amount: "20" }, {
            asset: xlm,
            amount: "10",
          }],
          minPrice: "0.5",
          maxPrice: "0.5",
        }),
      BASE_FEE_TOO_LOW_ERROR,
    );
    const depositOp = Operation.fromXdrObject(
      depositError.meta.data.input.operations[0],
    );
    assert(depositOp.type === "liquidityPoolDeposit");
    assertEquals(depositOp.maxAmountA, "10.0000000");
    assertEquals(depositOp.maxAmountB, "20.0000000");
    assertEquals(depositOp.minPrice, "0.5");
    const withdrawError = await assertRejects(
      () =>
        pool.withdrawByAsset({
          config,
          amount: "2",
          minimumAmounts: [{ asset: usd, amount: "4" }, {
            asset: xlm,
            amount: "2",
          }],
        }),
      BASE_FEE_TOO_LOW_ERROR,
    );
    const withdrawOp = Operation.fromXdrObject(
      withdrawError.meta.data.input.operations[0],
    );
    assert(withdrawOp.type === "liquidityPoolWithdraw");
    assertEquals(withdrawOp.minAmountA, "2.0000000");
    assertEquals(withdrawOp.minAmountB, "4.0000000");
  });

  it("rejects duplicate, unrelated and incomplete asset-labelled amounts", () => {
    assertThrows(
      () =>
        pool.depositByAsset({
          config,
          maximumAmounts: [{ asset: usd, amount: "1" }, {
            asset: usd,
            amount: "1",
          }],
          minPrice: "1",
          maxPrice: "1",
        }),
      E.INVALID_DEPOSIT_ASSETS,
    );
    assertThrows(
      () =>
        pool.withdrawByAsset({
          config,
          amount: "1",
          minimumAmounts: [{ asset: xlm, amount: "0" }, {
            asset: new Asset("EUR", signer.publicKey()),
            amount: "0",
          }],
        }),
      E.INVALID_WITHDRAWAL_ASSETS,
    );
    const incomplete =
      [] as unknown as PoolDepositByAssetArgs["maximumAmounts"];
    assertThrows(
      () =>
        pool.depositByAsset({
          config,
          maximumAmounts: incomplete,
          minPrice: "1",
          maxPrice: "1",
        }),
      E.INVALID_DEPOSIT_ASSETS,
    );
  });

  it("reports genuine RPC transport failure separately from a missing pool", async () => {
    // Reserve an unused port, then close it: the native RPC encounters a real refusal.
    const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
    const port = listener.addr.port;
    listener.close();
    const offline = new NativeLiquidityPool({
      assets: [xlm, usd],
      networkConfig: NetworkConfig.CustomNet({
        networkPassphrase: "offline",
        rpcUrl: `http://127.0.0.1:${port}`,
        allowHttp: true,
      }),
    });
    const error = await assertRejects(
      () => offline.getState(),
      E.FAILED_TO_READ_POOL,
    );
    assert(error.meta?.cause instanceof Error);
    const trustlineError = await assertRejects(
      () => offline.getTrustline(signer.publicKey()),
      E.FAILED_TO_READ_TRUSTLINE,
    );
    assert(trustlineError.meta?.cause instanceof Error);
  });
});
