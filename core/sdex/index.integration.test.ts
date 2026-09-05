import { assert, assertEquals, assertRejects } from "@std/assert";
import { afterAll, beforeAll, describe, it } from "@std/testing/bdd";
import { Asset, Operation, TransactionBuilder, type xdr } from "stellar-sdk";
import { StellarTestLedger } from "@colibri/test-tooling";
import { createChannelAccountsPlugin } from "@colibri/plugin-channel-accounts";
import { NativeAccount } from "@/account/native/index.ts";
import { disableSanitizeConfig } from "colibri-internal/tests/disable-sanitize-config.ts";
import { SDEX } from "@/sdex/index.ts";
import { OFFER_NOT_FOUND } from "@/sdex/error.ts";
import { NetworkConfig } from "@/network/index.ts";
import { LocalSigner } from "@/signer/local/index.ts";
import { initializeWithFriendbot } from "@/tools/friendbot/initialize-with-friendbot.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { ClassicTransactionOutput } from "@/pipelines/classic-transaction/types.ts";

describe(
  "SDEX native exchange workflows on Quickstart",
  disableSanitizeConfig,
  () => {
    const ledger = new StellarTestLedger({
      containerName: `colibri-sdex-${crypto.randomUUID()}`,
      containerImageVersion: "testing",
      logLevel: "silent",
    });
    const issuer = LocalSigner.generateRandom();
    const maker = LocalSigner.generateRandom();
    const taker = LocalSigner.generateRandom();
    const usd = new Asset("USD", issuer.publicKey());
    const xlm = Asset.native();
    let networkConfig: NetworkConfig;
    let sdex: SDEX;

    const config = (signer: LocalSigner): TransactionConfig => ({
      source: signer.publicKey(),
      signers: [signer],
      fee: "100",
      timeout: 60,
    });
    const success = (
      result: ClassicTransactionOutput,
    ): xdr.ManageOfferSuccessResult => {
      const outcome = result.operations[0];
      assert(
        outcome.type === "manageSellOffer" ||
          outcome.type === "manageBuyOffer" ||
          outcome.type === "createPassiveSellOffer",
      );
      assertEquals(result.response.status, "SUCCESS");
      assertEquals(result.feeCharged, 100n);
      return outcome.result.success;
    };
    const createdId = (result: ClassicTransactionOutput): string => {
      const offer = success(result).offer;
      assert(offer.type === "manageOfferCreated");
      return String(offer.offer.offerId);
    };
    const nativeOperation = (
      result: ClassicTransactionOutput,
    ): xdr.Operation => {
      const transaction = TransactionBuilder.fromXdr(
        result.response.envelopeXdr.toXdr("base64"),
        networkConfig.networkPassphrase,
      );
      assert("operations" in transaction);
      const envelope = transaction.toEnvelope();
      assert(envelope.type === "envelopeTypeTx");
      return envelope.v1.tx.operations[0];
    };

    beforeAll(async () => {
      await ledger.start();
      networkConfig = NetworkConfig.CustomNet(
        await ledger.getNetworkConfiguration(),
      );
      await initializeWithFriendbot(
        networkConfig.friendbotUrl!,
        issuer.publicKey(),
        { rpcUrl: networkConfig.rpcUrl!, allowHttp: true },
      );
      sdex = new SDEX({ networkConfig });
      await sdex.transactionPipe({
        operations: [maker, taker].map((signer) =>
          Operation.createAccount({
            destination: signer.publicKey(),
            startingBalance: "1000",
          })
        ),
        config: config(issuer),
      });
      await sdex.transactionPipe({
        operations: [
          Operation.changeTrust({
            source: maker.publicKey(),
            asset: usd,
            limit: "10000",
          }),
          Operation.changeTrust({
            source: taker.publicKey(),
            asset: usd,
            limit: "10000",
          }),
          Operation.payment({
            destination: maker.publicKey(),
            asset: usd,
            amount: "1000",
          }),
          Operation.payment({
            destination: taker.publicKey(),
            asset: usd,
            amount: "1000",
          }),
        ],
        config: { ...config(issuer), signers: [issuer, maker, taker] },
      });
    });
    afterAll(async () => {
      await ledger.stop();
      await ledger.destroy();
    });

    it("creates, reads, updates, and cancels a standing sell offer with confirmed exact prices", async () => {
      const created = await sdex.createSellOffer({
        selling: usd,
        buying: xlm,
        amount: "10",
        price: { n: 2, d: 1 },
        config: config(maker),
      });
      const offerId = createdId(created);
      const offer = await sdex.getOffer({ seller: maker.publicKey(), offerId });
      assert(offer);
      assertEquals(offer.amount, 100_000_000n);
      assertEquals(offer.price, { n: 2, d: 1 });
      const changed = await sdex.updateSellOffer({
        selling: usd,
        buying: xlm,
        amount: "5",
        price: "2.5",
        offerId,
        config: config(maker),
      });
      assertEquals(success(changed).offer.type, "manageOfferUpdated");
      assertEquals(
        (await sdex.getOffer({ seller: maker.publicKey(), offerId }))?.price,
        { n: 5, d: 2 },
      );
      const cancelled = await sdex.cancelOffer({
        seller: maker.publicKey(),
        offerId,
        config: { ...config(issuer), signers: [issuer, maker] },
      });
      assertEquals(success(cancelled).offer.type, "manageOfferDeleted");
      assertEquals(
        await sdex.getOffer({ seller: maker.publicKey(), offerId }),
        null,
      );
      await assertRejects(() =>
        sdex.cancelOffer({
          seller: maker.publicKey(),
          offerId,
          config: config(maker),
        }), OFFER_NOT_FOUND);
    });

    it("keeps buy price direction and operation-source signing distinct from the transaction source", async () => {
      const created = await sdex.createBuyOffer({
        selling: xlm,
        buying: usd,
        buyAmount: "10",
        price: { n: 2, d: 1 },
        source: maker.publicKey(),
        config: { ...config(issuer), signers: [issuer, maker] },
      });
      const offerId = createdId(created);
      const op = nativeOperation(created);
      assert(op.body.type === "manageBuyOffer");
      assertEquals(op.body.manageBuyOfferOp.buyAmount, 100_000_000n);
      assertEquals(op.body.manageBuyOfferOp.price.n, 2);
      assertEquals(op.body.manageBuyOfferOp.price.d, 1);
      // Ledger offers always store buying per selling, so buy-op price is inverted.
      assertEquals(
        (await sdex.getOffer({ seller: maker.publicKey(), offerId }))?.price,
        { n: 1, d: 2 },
      );
      const updated = await sdex.updateBuyOffer({
        selling: xlm,
        buying: usd,
        buyAmount: "5",
        price: { n: 3, d: 2 },
        offerId,
        config: config(maker),
      });
      assertEquals(success(updated).offer.type, "manageOfferUpdated");
      await sdex.cancelOffer({
        seller: maker.publicKey(),
        offerId,
        config: config(maker),
      });
    });

    it("does not claim that a fully crossing offer remains on the ledger", async () => {
      const makerId = createdId(
        await sdex.sell({
          asset: usd,
          receive: xlm,
          amount: "10",
          minimumReceivePerUnit: "2",
          config: config(maker),
        }),
      );
      const bought = await sdex.buy({
        asset: usd,
        payWith: xlm,
        amount: "10",
        maximumSpendPerUnit: "2",
        config: config(taker),
      });
      const outcome = success(bought);
      assertEquals(outcome.offer.type, "manageOfferDeleted");
      assertEquals(outcome.offersClaimed.length, 1);
      assertEquals(
        await sdex.getOffer({ seller: maker.publicKey(), offerId: makerId }),
        null,
      );
      const operation = nativeOperation(bought);
      assert(operation.body.type === "manageBuyOffer");
      assertEquals(operation.body.manageBuyOfferOp.price.toXdrObject(), {
        n: 2,
        d: 1,
      });
    });

    it("reports partial fills and retains the remaining offer amount", async () => {
      const makerId = createdId(
        await sdex.sell({
          asset: usd,
          receive: xlm,
          amount: "10",
          minimumReceivePerUnit: "1.25",
          config: config(maker),
        }),
      );
      const bought = await sdex.buy({
        asset: usd,
        payWith: xlm,
        amount: "4",
        maximumSpendPerUnit: "1.25",
        config: config(taker),
      });
      assertEquals(success(bought).offersClaimed.length, 1);
      const remaining = await sdex.getOffer({
        seller: maker.publicKey(),
        offerId: makerId,
      });
      assertEquals(remaining?.amount, 60_000_000n);
      assertEquals(remaining?.price, { n: 5, d: 4 });
      await sdex.cancelOffer({
        seller: maker.publicKey(),
        offerId: makerId,
        config: config(maker),
      });
    });

    it("keeps equally priced passive offers standing instead of crossing them", async () => {
      const makerId = createdId(
        await sdex.createSellOffer({
          selling: usd,
          buying: xlm,
          amount: "10",
          price: "2",
          config: config(maker),
        }),
      );
      const passive = await sdex.createPassiveSellOffer({
        selling: xlm,
        buying: usd,
        amount: "20",
        price: { n: 1, d: 2 },
        config: config(taker),
      });

      const passiveId = createdId(passive);
      assertEquals(success(passive).offersClaimed.length, 0);
      assertEquals(
        (await sdex.getOffer({ seller: taker.publicKey(), offerId: passiveId }))
          ?.flags.passive,
        true,
      );
      await sdex.cancelOffer({
        seller: maker.publicKey(),
        offerId: makerId,
        config: config(maker),
      });
      await sdex.cancelOffer({
        seller: taker.publicKey(),
        offerId: passiveId,
        config: config(taker),
      });
    });

    it("keeps offers owned by the trader when a channel plugin supplies the envelope source", async () => {
      const channelSdex = new SDEX({ networkConfig });
      channelSdex.transactionPipe.use(createChannelAccountsPlugin({
        channels: [NativeAccount.fromMasterSigner(issuer)],
      }));
      const result = await channelSdex.sell({
        asset: usd,
        receive: xlm,
        amount: "3",
        minimumReceivePerUnit: "2",
        config: config(maker),
      });
      const offerId = createdId(result);
      const tx = TransactionBuilder.fromXdr(
        result.response.envelopeXdr.toXdr("base64"),
        networkConfig.networkPassphrase,
      );
      assert("source" in tx);
      assertEquals(tx.source, issuer.publicKey());
      assertEquals(
        Operation.fromXdrObject(nativeOperation(result)).source,
        maker.publicKey(),
      );
      assertEquals(
        (await channelSdex.getOffer({ seller: maker.publicKey(), offerId }))
          ?.amount,
        30_000_000n,
      );
      assertEquals(
        await channelSdex.getOffer({ seller: issuer.publicKey(), offerId }),
        null,
      );
      await channelSdex.cancelOffer({
        seller: maker.publicKey(),
        offerId,
        config: config(maker),
      });
    });
  },
);
