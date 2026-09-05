import type { Asset as SdkAsset } from "stellar-sdk";

/** @internal Native SDK asset alias for JSR declarations. */
type Asset = SdkAsset;

/** Native SDK-compatible, integer numerator/denominator price. */
export type StellarPriceRatio = { n: number; d: number };

/** Explicit units for describing a price, independent of buy/sell operation conventions. */
export type DescribeStellarPriceArgs = {
  /** Units of `quoteAsset` received or paid per one unit of `baseAsset`. */
  price: StellarPriceRatio;
  /** Asset whose quantity is one in the price description. */
  baseAsset: Asset;
  /** Asset in which that one unit is priced. */
  quoteAsset: Asset;
};
