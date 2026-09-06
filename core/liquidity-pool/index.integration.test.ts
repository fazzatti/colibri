import { assert, assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Asset, Operation } from "stellar-sdk";
import { StellarTestLedger } from "@colibri/test-tooling";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { NativeLiquidityPool } from "@/liquidity-pool/index.ts";
import {
  POOL_NOT_FOUND,
  POSITION_POOL_MISSING,
  POSITION_TRUSTLINE_MISSING,
} from "@/liquidity-pool/error.ts";
import { NetworkConfig } from "@/network/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { ClassicTransactionOutput } from "@/pipelines/classic-transaction/types.ts";

describe(
  "NativeLiquidityPool confirmed ledger workflows",
  disableSanitizeConfig,
  () => {
    const ledger = new StellarTestLedger({
      containerName: `colibri-native-pool-${crypto.randomUUID()}`,
      containerImageVersion: "testing",
      logLevel: "silent",
    });
    const issuer = LocalSigner.generateRandom();
    const provider = LocalSigner.generateRandom();
    const usd = new Asset("USD", issuer.publicKey());
    const xlm = Asset.native();
    let pool: NativeLiquidityPool;
    let config: TransactionConfig;
    const confirmedOperation = (result: ClassicTransactionOutput) => {
      assertEquals(result.response.status, "SUCCESS");
      assertEquals(result.feeCharged, 100n);
      const envelope = result.response.envelopeXdr;
      assert(envelope.type === "envelopeTypeTx");
      assertEquals(envelope.v1.tx.fee, 100);
      return Operation.fromXdrObject(envelope.v1.tx.operations[0]);
    };
    beforeAll(async () => {
      await ledger.start();
      const networkConfig = NetworkConfig.CustomNet(
        await ledger.getNetworkConfiguration(),
      );
      pool = new NativeLiquidityPool({ assets: [usd, xlm], networkConfig });
      await initializeWithFriendbot(
        networkConfig.friendbotUrl!,
        issuer.publicKey(),
        { rpcUrl: networkConfig.rpcUrl!, allowHttp: true },
      );
      await pool.transactionPipe({
        operations: [
          Operation.createAccount({
            destination: provider.publicKey(),
            startingBalance: "1000",
          }),
          Operation.changeTrust({
            source: provider.publicKey(),
            asset: usd,
            limit: "10000",
          }),
          Operation.payment({
            destination: provider.publicKey(),
            asset: usd,
            amount: "1000",
          }),
        ],
        config: {
          source: issuer.publicKey(),
          signers: [issuer, provider],
          fee: "100",
          timeout: 60,
        },
      });
      config = {
        source: provider.publicKey(),
        signers: [provider],
        fee: "100",
        timeout: 60,
      };
    });
    afterAll(async () => {
      await ledger.stop();
      await ledger.destroy();
    });

    it("does not create a pool during construction or read", async () => {
      await assertRejects(() => pool.getState(), POOL_NOT_FOUND);
      const op = confirmedOperation(await pool.changeTrust({ config }));
      assertEquals(op.type, "changeTrust");
      const trustline = await pool.getTrustline(provider.publicKey());
      assertEquals(trustline.balance, 0n);
      assertEquals(trustline.asset, `pool:${pool.poolId}`);
    });

    it("distinguishes absent and empty positions before any deposit", async () => {
      const absent = new NativeLiquidityPool({
        assets: [xlm, new Asset("ABSENT", issuer.publicKey())],
        networkConfig: pool.networkConfig,
      });
      await assertRejects(
        () => absent.getPosition(provider.publicKey()),
        POSITION_POOL_MISSING,
      );
      await assertRejects(
        () => pool.getPosition(issuer.publicKey()),
        POSITION_TRUSTLINE_MISSING,
      );
      const position = await pool.getPosition(provider.publicKey());
      assertEquals(position.trustline.balance, 0n);
      assertEquals(position.pool.totalPoolShares, 0n);
      assertEquals(position.ownership, null);
    });

    it("deposits non-equal amounts at the exact native A/B price and verifies on-chain reserves", async () => {
      const result = await pool.deposit({
        maxAmountA: "100",
        maxAmountB: "200",
        minPrice: { n: 1, d: 2 },
        maxPrice: { n: 1, d: 2 },
        config,
      });
      const op = confirmedOperation(result);
      assert(op.type === "liquidityPoolDeposit");
      assertEquals(op.maxAmountA, "100.0000000");
      assertEquals(op.maxAmountB, "200.0000000");
      assertEquals(op.minPrice, "0.5");
      assertEquals(op.maxPrice, "0.5");
      assertEquals(op.source, provider.publicKey());
      const state = await pool.getState();
      assertEquals(state.reserveA, 1_000_000_000n);
      assertEquals(state.reserveB, 2_000_000_000n);
      assertEquals(state.fee, 30);
      assert(state.lastModifiedLedgerSeq !== undefined);
      assert(state.observedAtLedger >= state.lastModifiedLedgerSeq);
      assert(state.totalPoolShares > 0n);
      assertEquals(
        (await pool.getTrustline(provider.publicKey())).balance,
        state.totalPoolShares,
      );
    });

    it("maps labelled deposits and withdrawals without rewriting the transaction source", async () => {
      const deposit = await pool.depositByAsset({
        maximumAmounts: [{ asset: usd, amount: "20" }, {
          asset: xlm,
          amount: "10",
        }],
        minPrice: "0.5",
        maxPrice: "0.5",
        source: provider.publicKey(),
        config: {
          ...config,
          source: issuer.publicKey(),
          signers: [issuer, provider],
        },
      });
      const deposited = confirmedOperation(deposit);
      assert(deposited.type === "liquidityPoolDeposit");
      assertEquals(deposited.source, provider.publicKey());
      const before = await pool.getState();
      assertEquals(before.reserveA, 1_100_000_000n);
      assertEquals(before.reserveB, 2_200_000_000n);
      const withdrawn = confirmedOperation(
        await pool.withdrawByAsset({
          amount: "1",
          minimumAmounts: [{ asset: usd, amount: "0" }, {
            asset: xlm,
            amount: "0",
          }],
          config,
        }),
      );
      assert(withdrawn.type === "liquidityPoolWithdraw");
      assertEquals(withdrawn.amount, "1.0000000");
      const after = await pool.getState();
      assert(after.reserveA < before.reserveA);
      assert(after.reserveB < before.reserveB);
      assertEquals(after.totalPoolShares, before.totalPoolShares - 10_000_000n);
      assertEquals(
        (await pool.getTrustline(provider.publicKey())).balance,
        after.totalPoolShares,
      );
    });

    it("uses named price units in a confirmed deposit and observes the complete holder position", async () => {
      const result = await pool.depositByAsset({
        maximumAmounts: [{ asset: usd, amount: "2" }, {
          asset: xlm,
          amount: "1",
        }],
        ...pool.priceBounds({
          baseAsset: xlm,
          quoteAsset: usd,
          minimum: "2",
          maximum: "2",
        }),
        config,
      });
      const operation = confirmedOperation(result);
      assert(operation.type === "liquidityPoolDeposit");
      assertEquals(operation.minPrice, "0.5");
      assertEquals(operation.maxPrice, "0.5");
      const position = await pool.getPosition(provider.publicKey());
      assert(position.ownership);
      assertEquals(position.ownership.shares, position.pool.totalPoolShares);
      assertEquals(
        position.ownership.totalShares,
        position.pool.totalPoolShares,
      );
      assertEquals(position.trustline.balance, position.pool.totalPoolShares);
      const independentlyRead = await pool.getState();
      assertEquals(position.pool.reserveA, independentlyRead.reserveA);
      assertEquals(position.pool.reserveB, independentlyRead.reserveB);
      assert(position.observedAtLedger >= position.pool.lastModifiedLedgerSeq!);
      assert(
        position.observedAtLedger >= position.trustline.lastModifiedLedgerSeq!,
      );
    });
  },
);
