import { assertEquals, assertRejects } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import { Asset, Keypair, Operation } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { NetworkConfig } from "@/network/index.ts";
import { SDEX } from "@/markets/sdex/index.ts";
import * as ERROR from "@/markets/sdex/error.ts";
import { ColibriError } from "@/error/index.ts";
import { BASE_FEE_TOO_LOW_ERROR } from "@/processes/build-transaction/error.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";

const { describe, it, observer: suiteObserver } = recordColibriTests(
  import.meta.url,
);

describe("SDEX explicit operation boundaries", () => {
  const networkConfig = NetworkConfig.TestNet();
  const sdex = suiteObserver.attach(new SDEX({ networkConfig }), {
    name: "sdex",
  });
  const selling = new Asset("USD", Keypair.random().publicKey());
  const buying = Asset.native();
  // Intentionally invalid fee: real pipeline validation must reject
  // before it accesses RPC. No network or transaction behavior is replaced.
  const config: TransactionConfig = {
    source: Keypair.random().publicKey() as Ed25519PublicKey,
    signers: [],
    fee: "0",
    timeout: 30,
  };
  const sell = { selling, buying, amount: "10", price: { n: 2, d: 1 }, config };
  const buy = {
    selling,
    buying,
    buyAmount: "10",
    price: { n: 2, d: 1 },
    config,
  };

  it("wraps real offer lookup and cancellation transport failures without changing key validation", async () => {
    const unavailable = suiteObserver.attach(
      new SDEX({
        networkConfig,
        rpc: new Server("http://127.0.0.1:0", { allowHttp: true }),
      }),
      { name: "unavailable" },
    );
    const args = { seller: config.source as Ed25519PublicKey, offerId: "1" };
    for (
      const action of [
        () => unavailable.getOffer(args),
        () => unavailable.cancelOffer({ ...args, config }),
      ]
    ) {
      const error = await assertRejects(action, ERROR.READ_OFFER_FAILED);
      assertEquals(error.meta?.cause instanceof Error, true);
      assertEquals(ERROR.ERROR_SDEX[error.code], ERROR.READ_OFFER_FAILED);
    }
  });

  it("maps plain-language updates and passive sells to native operation prices and identities", async () => {
    const actions = [
      {
        run: () =>
          sdex.updateSell({
            asset: selling,
            receive: buying,
            amount: "7",
            minimumReceivePerUnit: "1.25",
            offerId: "42",
            config,
          }),
        expected: Operation.manageSellOffer({
          selling,
          buying,
          amount: "7",
          price: { n: 5, d: 4 },
          offerId: "42",
          source: config.source,
        }),
      },
      {
        run: () =>
          sdex.updateBuy({
            asset: buying,
            payWith: selling,
            amount: "7",
            maximumSpendPerUnit: "1.25",
            offerId: "42",
            config,
          }),
        expected: Operation.manageBuyOffer({
          selling,
          buying,
          buyAmount: "7",
          price: { n: 5, d: 4 },
          offerId: "42",
          source: config.source,
        }),
      },
      {
        run: () =>
          sdex.passiveSell({
            asset: selling,
            receive: buying,
            amount: "7",
            minimumReceivePerUnit: "1.25",
            config,
          }),
        expected: Operation.createPassiveSellOffer({
          selling,
          buying,
          amount: "7",
          price: { n: 5, d: 4 },
          source: config.source,
        }),
      },
    ];
    for (const { run, expected } of actions) {
      const error = await assertRejects(run, BASE_FEE_TOO_LOW_ERROR);
      assertEquals(
        error.meta.data.input.operations[0].toXdr("base64"),
        expected.toXdr("base64"),
      );
    }
  });

  it("owns the existing callable transaction pipeline and accepts a native RPC server", () => {
    assertEquals(typeof sdex.transactionPipe, "function");
    const rpc = new Server(networkConfig.rpcUrl!);
    assertEquals(
      suiteObserver.attach(new SDEX({ networkConfig, rpc }), { name: "client" })
        .ledgerEntries.rpc,
      rpc,
    );
  });

  it("maps each native SDK construction failure to its own typed occurrence", async () => {
    await assertRejects(
      () => sdex.createSellOffer({ ...sell, amount: "invalid" }),
      ERROR.CREATE_SELL_FAILED,
    );
    await assertRejects(
      () => sdex.updateSellOffer({ ...sell, offerId: "1", amount: "invalid" }),
      ERROR.UPDATE_SELL_FAILED,
    );
    await assertRejects(
      () => sdex.createBuyOffer({ ...buy, buyAmount: "invalid" }),
      ERROR.CREATE_BUY_FAILED,
    );
    await assertRejects(
      () => sdex.updateBuyOffer({ ...buy, offerId: "1", buyAmount: "invalid" }),
      ERROR.UPDATE_BUY_FAILED,
    );
    await assertRejects(
      () => sdex.createPassiveSellOffer({ ...sell, amount: "invalid" }),
      ERROR.CREATE_PASSIVE_FAILED,
    );
  });

  it("does not turn an update with ID zero into a new offer", async () => {
    for (const offerId of ["0", "-1", "x", "9223372036854775808", 1]) {
      await assertRejects(
        () => sdex.updateSellOffer({ ...sell, offerId: offerId as string }),
        ERROR.INVALID_UPDATE_SELL_ID,
      );
      await assertRejects(
        () => sdex.updateBuyOffer({ ...buy, offerId: offerId as string }),
        ERROR.INVALID_UPDATE_BUY_ID,
      );
    }
  });

  it("passes valid operations into real pipeline validation without replacing its errors", async () => {
    const actions = [
      () => sdex.createSellOffer(sell),
      () => sdex.updateSellOffer({ ...sell, offerId: "1" }),
      () => sdex.createBuyOffer(buy),
      () => sdex.updateBuyOffer({ ...buy, offerId: "1" }),
      () => sdex.createPassiveSellOffer(sell),
      () =>
        sdex.sell({
          asset: selling,
          receive: buying,
          amount: "10",
          minimumReceivePerUnit: "2",
          config,
        }),
      () =>
        sdex.buy({
          asset: buying,
          payWith: selling,
          amount: "10",
          maximumSpendPerUnit: "2",
          config,
        }),
    ];
    for (const action of actions) {
      const error = await assertRejects(action, ColibriError);
      assertEquals(error.source.includes("sdex"), false);
    }
  });

  it("retains typed ledger-key validation for reads and cancellation", async () => {
    const args = { seller: "invalid" as Ed25519PublicKey, offerId: "1" };
    await assertRejects(() => sdex.getOffer(args), ColibriError);
    await assertRejects(
      () => sdex.getOffer({ ...args, offerId: 1 }),
      ColibriError,
    );
    await assertRejects(
      () => sdex.cancelOffer({ ...args, config }),
      ColibriError,
    );
  });

  it("rejects unsafe numeric offer IDs before any RPC read or cancellation", async () => {
    for (const offerId of [Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, 1.5]) {
      const args = { seller: config.source as Ed25519PublicKey, offerId };
      await assertRejects(() => sdex.getOffer(args), ERROR.UNSAFE_OFFER_ID);
      await assertRejects(
        () => sdex.cancelOffer({ ...args, config }),
        ERROR.UNSAFE_OFFER_ID,
      );
    }
  });

  it("pins the logical operation source before plugins can replace the transaction source", async () => {
    const explicit = Keypair.random().publicKey();
    for (const source of [undefined, explicit]) {
      const actions = [
        () => sdex.createSellOffer({ ...sell, source }),
        () => sdex.updateSellOffer({ ...sell, offerId: "1", source }),
        () => sdex.createBuyOffer({ ...buy, source }),
        () => sdex.updateBuyOffer({ ...buy, offerId: "1", source }),
        () => sdex.createPassiveSellOffer({ ...sell, source }),
      ];
      for (const action of actions) {
        const error = await assertRejects(action, BASE_FEE_TOO_LOW_ERROR);
        assertEquals(
          Operation.fromXdrObject(error.meta.data.input.operations[0]).source,
          source ?? config.source,
        );
        assertEquals(error.meta.data.input.source, config.source);
      }
    }
  });

  it("exports typed error constructors with distinct stable codes and SDK causes", () => {
    const cause = new TypeError("SDK validation");
    const errors = [
      new ERROR.CREATE_SELL_FAILED(cause),
      new ERROR.UPDATE_SELL_FAILED(cause),
      new ERROR.CREATE_BUY_FAILED(cause),
      new ERROR.UPDATE_BUY_FAILED(cause),
      new ERROR.CREATE_PASSIVE_FAILED(cause),
      new ERROR.OFFER_NOT_FOUND("seller", "1"),
      new ERROR.INVALID_UPDATE_BUY_ID(),
      new ERROR.INVALID_UPDATE_SELL_ID(),
      new ERROR.UNSAFE_OFFER_ID(Number.MAX_SAFE_INTEGER + 1),
    ];
    for (const error of errors) {
      assertEquals(error instanceof ColibriError, true);
      assertEquals(ERROR.ERROR_SDEX[error.code], error.constructor);
    }
    assertEquals(errors[0].meta?.cause, cause);
  });
});
