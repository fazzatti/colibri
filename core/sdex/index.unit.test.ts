import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Asset, Keypair, Operation } from "stellar-sdk";
import { Server } from "stellar-sdk/rpc";
import { NetworkConfig } from "@/network/index.ts";
import { SDEX } from "@/sdex/index.ts";
import * as E from "@/sdex/error.ts";
import { ColibriError } from "@/error/index.ts";
import { BASE_FEE_TOO_LOW_ERROR } from "@/processes/build-transaction/error.ts";
import type { TransactionConfig } from "@/common/types/transaction-config/types.ts";
import type { Ed25519PublicKey } from "@/strkeys/types.ts";

describe("SDEX explicit operation boundaries", () => {
  const networkConfig = NetworkConfig.TestNet();
  const sdex = new SDEX({ networkConfig });
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

  it("owns the existing callable transaction pipeline and accepts a native RPC server", () => {
    assertEquals(typeof sdex.transactionPipe, "function");
    const rpc = new Server(networkConfig.rpcUrl!);
    assertEquals(new SDEX({ networkConfig, rpc }).ledgerEntries.rpc, rpc);
  });

  it("maps each native SDK construction failure to its own typed occurrence", async () => {
    await assertRejects(
      () => sdex.createSellOffer({ ...sell, amount: "invalid" }),
      E.CREATE_SELL_FAILED,
    );
    await assertRejects(
      () => sdex.updateSellOffer({ ...sell, offerId: "1", amount: "invalid" }),
      E.UPDATE_SELL_FAILED,
    );
    await assertRejects(
      () => sdex.createBuyOffer({ ...buy, buyAmount: "invalid" }),
      E.CREATE_BUY_FAILED,
    );
    await assertRejects(
      () => sdex.updateBuyOffer({ ...buy, offerId: "1", buyAmount: "invalid" }),
      E.UPDATE_BUY_FAILED,
    );
    await assertRejects(
      () => sdex.createPassiveSellOffer({ ...sell, amount: "invalid" }),
      E.CREATE_PASSIVE_FAILED,
    );
  });

  it("does not turn an update with ID zero into a new offer", async () => {
    for (const offerId of ["0", "-1", "x", "9223372036854775808", 1]) {
      await assertRejects(
        () => sdex.updateSellOffer({ ...sell, offerId: offerId as string }),
        E.INVALID_UPDATE_SELL_ID,
      );
      await assertRejects(
        () => sdex.updateBuyOffer({ ...buy, offerId: offerId as string }),
        E.INVALID_UPDATE_BUY_ID,
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
    assertThrows(() => sdex.getOffer(args), ColibriError);
    assertThrows(() => sdex.getOffer({ ...args, offerId: 1 }), ColibriError);
    await assertRejects(
      () => sdex.cancelOffer({ ...args, config }),
      ColibriError,
    );
  });

  it("rejects unsafe numeric offer IDs before any RPC read or cancellation", async () => {
    for (const offerId of [Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, 1.5]) {
      const args = { seller: config.source as Ed25519PublicKey, offerId };
      assertThrows(() => sdex.getOffer(args), E.UNSAFE_OFFER_ID);
      await assertRejects(
        () => sdex.cancelOffer({ ...args, config }),
        E.UNSAFE_OFFER_ID,
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
      new E.CREATE_SELL_FAILED(cause),
      new E.UPDATE_SELL_FAILED(cause),
      new E.CREATE_BUY_FAILED(cause),
      new E.UPDATE_BUY_FAILED(cause),
      new E.CREATE_PASSIVE_FAILED(cause),
      new E.OFFER_NOT_FOUND("seller", "1"),
      new E.INVALID_UPDATE_BUY_ID(),
      new E.INVALID_UPDATE_SELL_ID(),
      new E.UNSAFE_OFFER_ID(Number.MAX_SAFE_INTEGER + 1),
    ];
    for (const error of errors) {
      assertEquals(error instanceof ColibriError, true);
      assertEquals(E.ERROR_SDEX[error.code], error.constructor);
    }
    assertEquals(errors[0].meta?.cause, cause);
  });
});
