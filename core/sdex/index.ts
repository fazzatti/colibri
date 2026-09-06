import { Asset, Operation, type xdr } from "stellar-sdk";
import { buildOfferLedgerKey, LedgerEntries } from "@/ledger-entries/index.ts";
import type { OfferLedgerEntry } from "@/ledger-entries/types.ts";
import { parseStellarAssetCanonicalString } from "@/asset/sep11/index.ts";
import type { StellarAssetCanonicalString } from "@/asset/sep11/types.ts";
import {
  type ClassicTransactionPipeline,
  createClassicTransactionPipeline,
} from "@/pipelines/classic-transaction/index.ts";
import type { ClassicTransactionOutput } from "@/pipelines/classic-transaction/types.ts";
import { StellarPrice } from "@/price/index.ts";
import * as E from "@/sdex/error.ts";
import { ColibriError } from "@/error/index.ts";
import type {
  BuyArgs,
  CancelOfferArgs,
  CreateBuyOfferArgs,
  CreatePassiveSellOfferArgs,
  CreateSellOfferArgs,
  GetOfferArgs,
  SDEXConstructorArgs,
  SellArgs,
  UpdateBuyArgs,
  UpdateBuyOfferArgs,
  UpdateSellArgs,
  UpdateSellOfferArgs,
} from "@/sdex/types.ts";

const isExistingOfferId = (value: string): boolean =>
  typeof value === "string" && /^\d+$/.test(value) && BigInt(value) > 0n &&
  BigInt(value) <= 9_223_372_036_854_775_807n;

const nativeAsset = (value: StellarAssetCanonicalString): Asset => {
  const { code, issuer } = parseStellarAssetCanonicalString(value);
  return new Asset(code, issuer);
};

/**
 * Explicit Stellar exchange offer operations through Colibri's existing pipeline.
 * There is no automatic trustline setup, market discovery, order-book indexing,
 * or guarantee that a submitted offer will remain on the ledger.
 */
export class SDEX {
  /** Owned callable pipeline; attach normal transaction plugins to this binding. */
  readonly transactionPipe: ClassicTransactionPipeline;
  /** RPC reader for known offer keys and other explicit ledger reads. */
  readonly ledgerEntries: LedgerEntries;

  /** Binds the class to the same network/RPC for reads and transactions. */
  constructor({ networkConfig, rpc, plugins }: SDEXConstructorArgs) {
    this.transactionPipe = createClassicTransactionPipeline({
      networkConfig,
      rpc,
    });
    this.ledgerEntries = new LedgerEntries(rpc ? { rpc } : { networkConfig });
    for (const plugin of plugins?.transactionPipe ?? []) {
      this.transactionPipe.use(plugin);
    }
  }

  /** Reads a known seller/ID pair, returning null if no live offer remains. */
  async getOffer(
    { seller, offerId }: GetOfferArgs,
  ): Promise<OfferLedgerEntry | null> {
    if (typeof offerId === "number" && !Number.isSafeInteger(offerId)) {
      throw new E.UNSAFE_OFFER_ID(offerId);
    }
    try {
      return await this.ledgerEntries.get(
        buildOfferLedgerKey({ sellerId: seller, offerId }),
      );
    } catch (cause) {
      if (cause instanceof ColibriError) throw cause;
      throw new E.READ_OFFER_FAILED(cause);
    }
  }

  /** Creates a sell offer. Price is buying units per selling unit, as in Stellar SDK. */
  async createSellOffer(
    { config, ...options }: CreateSellOfferArgs,
  ): Promise<ClassicTransactionOutput> {
    let operation: xdr.Operation;
    try {
      operation = Operation.manageSellOffer({
        ...options,
        offerId: "0",
        source: options.source ?? config.source,
      });
    } catch (cause) {
      throw new E.CREATE_SELL_FAILED(cause);
    }
    return await this.transactionPipe({ operations: [operation], config });
  }

  /** Updates a known offer. Price is buying units per selling unit; zero amount cancels. */
  async updateSellOffer(
    { config, ...options }: UpdateSellOfferArgs,
  ): Promise<ClassicTransactionOutput> {
    if (!isExistingOfferId(options.offerId)) {
      throw new E.INVALID_UPDATE_SELL_ID();
    }
    let operation: xdr.Operation;
    try {
      operation = Operation.manageSellOffer({
        ...options,
        source: options.source ?? config.source,
      });
    } catch (cause) {
      throw new E.UPDATE_SELL_FAILED(cause);
    }
    return await this.transactionPipe({ operations: [operation], config });
  }

  /** Creates a buy offer. Price is selling units per buying unit, as in Stellar SDK. */
  async createBuyOffer(
    { config, ...options }: CreateBuyOfferArgs,
  ): Promise<ClassicTransactionOutput> {
    let operation: xdr.Operation;
    try {
      operation = Operation.manageBuyOffer({
        ...options,
        offerId: "0",
        source: options.source ?? config.source,
      });
    } catch (cause) {
      throw new E.CREATE_BUY_FAILED(cause);
    }
    return await this.transactionPipe({ operations: [operation], config });
  }

  /** Updates a known offer with a buy target. Zero buyAmount cancels the offer. */
  async updateBuyOffer(
    { config, ...options }: UpdateBuyOfferArgs,
  ): Promise<ClassicTransactionOutput> {
    if (!isExistingOfferId(options.offerId)) {
      throw new E.INVALID_UPDATE_BUY_ID();
    }
    let operation: xdr.Operation;
    try {
      operation = Operation.manageBuyOffer({
        ...options,
        source: options.source ?? config.source,
      });
    } catch (cause) {
      throw new E.UPDATE_BUY_FAILED(cause);
    }
    return await this.transactionPipe({ operations: [operation], config });
  }

  /** Creates a passive sell offer, which does not consume an equally priced offer. */
  async createPassiveSellOffer(
    { config, ...options }: CreatePassiveSellOfferArgs,
  ): Promise<ClassicTransactionOutput> {
    let operation: xdr.Operation;
    try {
      operation = Operation.createPassiveSellOffer({
        ...options,
        source: options.source ?? config.source,
      });
    } catch (cause) {
      throw new E.CREATE_PASSIVE_FAILED(cause);
    }
    return await this.transactionPipe({ operations: [operation], config });
  }

  /**
   * Reads the known offer to obtain its asset pair, then submits a zero-amount
   * cancellation with the seller as operation source. The seller must sign.
   * The read is not an atomic snapshot; a concurrent fill can remove the offer.
   */
  async cancelOffer(
    { seller, offerId, config }: CancelOfferArgs,
  ): Promise<ClassicTransactionOutput> {
    const offer = await this.getOffer({ seller, offerId });
    if (!offer) throw new E.OFFER_NOT_FOUND(seller, String(offerId));
    return await this.updateSellOffer({
      selling: nativeAsset(offer.selling),
      buying: nativeAsset(offer.buying),
      amount: "0",
      price: offer.price,
      offerId: String(offer.offerId),
      source: seller,
      config,
    });
  }

  /** Sells up to amount at no less than the exact stated receive units per asset unit. */
  sell(
    { asset, amount, receive, minimumReceivePerUnit, source, config }: SellArgs,
  ): Promise<ClassicTransactionOutput> {
    return this.createSellOffer({
      selling: asset,
      buying: receive,
      amount,
      price: StellarPrice.fromDecimal(minimumReceivePerUnit),
      source,
      config,
    });
  }

  /** Buys up to amount at no more than the exact stated payment units per asset unit. */
  buy(
    { asset, amount, payWith, maximumSpendPerUnit, source, config }: BuyArgs,
  ): Promise<ClassicTransactionOutput> {
    return this.createBuyOffer({
      selling: payWith,
      buying: asset,
      buyAmount: amount,
      price: StellarPrice.fromDecimal(maximumSpendPerUnit),
      source,
      config,
    });
  }

  /** Updates a sell limit using receive units per asset unit; zero amount cancels. */
  updateSell(
    { asset, amount, receive, minimumReceivePerUnit, ...args }: UpdateSellArgs,
  ): Promise<ClassicTransactionOutput> {
    return this.updateSellOffer({
      ...args,
      selling: asset,
      buying: receive,
      amount,
      price: StellarPrice.fromDecimal(minimumReceivePerUnit),
    });
  }

  /** Updates a buy limit using payment units per asset unit; zero amount cancels. */
  updateBuy(
    { asset, amount, payWith, maximumSpendPerUnit, ...args }: UpdateBuyArgs,
  ): Promise<ClassicTransactionOutput> {
    return this.updateBuyOffer({
      ...args,
      selling: payWith,
      buying: asset,
      buyAmount: amount,
      price: StellarPrice.fromDecimal(maximumSpendPerUnit),
    });
  }

  /** Creates a plain-language sell limit without consuming equally priced offers. */
  passiveSell(
    { asset, amount, receive, minimumReceivePerUnit, ...args }: SellArgs,
  ): Promise<ClassicTransactionOutput> {
    return this.createPassiveSellOffer({
      ...args,
      selling: asset,
      buying: receive,
      amount,
      price: StellarPrice.fromDecimal(minimumReceivePerUnit),
    });
  }
}

export type * from "@/sdex/types.ts";
export { ERROR_SDEX as SDEXErrors } from "@/sdex/error.ts";
