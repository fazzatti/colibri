import type { Asset } from "stellar-sdk";
import type {
  DescribeStellarPriceArgs,
  StellarPriceRatio,
} from "@/price/types.ts";
import * as E from "@/price/error.ts";

const INT32_MAX = 2_147_483_647;

const gcd = (a: bigint, b: bigint): bigint => {
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a;
};

const reduced = (n: bigint, d: bigint): [bigint, bigint] => {
  const divisor = gcd(n, d);
  return [n / divisor, d / divisor];
};

const validComponent = (value: number): boolean =>
  Number.isInteger(value) && value > 0 && value <= INT32_MAX;

const validateRatio = (price: StellarPriceRatio): void => {
  if (!price || !validComponent(price.n) || !validComponent(price.d)) {
    throw new E.INVALID_RATIO(price);
  }
};

const label = (asset: Asset): string =>
  asset.isNative() ? "XLM (native)" : `${asset.code}:${asset.issuer}`;

/**
 * Exact conversion and unit-labelled formatting for Stellar offer/pool prices.
 * Decimal helpers never approximate or round a caller's financial limit.
 * Native SDK operation methods remain available for other price inputs.
 */
export class StellarPrice {
  /**
   * Converts a strictly positive plain decimal string to its exact reduced ratio.
   * Throws when either reduced component exceeds positive int32. For example,
   * `"1.25"` becomes `{ n: 5, d: 4 }`, while `"0.0000000001"` is rejected.
   */
  static fromDecimal(value: string): StellarPriceRatio {
    if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) {
      throw new E.INVALID_DECIMAL(value);
    }
    const [whole, fraction = ""] = value.split(".");
    const numerator = BigInt(whole + fraction);
    if (numerator === 0n) {
      throw new E.NON_POSITIVE_DECIMAL(value);
    }
    const [n, d] = reduced(numerator, 10n ** BigInt(fraction.length));
    if (n > BigInt(INT32_MAX) || d > BigInt(INT32_MAX)) {
      throw new E.UNREPRESENTABLE_DECIMAL(value);
    }
    return { n: Number(n), d: Number(d) };
  }

  /** Reverses the price direction exactly, without modifying the input. */
  static invert(price: StellarPriceRatio): StellarPriceRatio {
    validateRatio(price);
    return { n: price.d, d: price.n };
  }

  /**
   * Formats a fraction without rounding. Terminating fractions use decimals;
   * repeating fractions remain exact `n/d` text instead of a truncated decimal.
   */
  static format(price: StellarPriceRatio): string {
    validateRatio(price);
    const [n, d] = reduced(BigInt(price.n), BigInt(price.d));
    let remaining = d;
    for (const factor of [2n, 5n]) {
      while (remaining % factor === 0n) remaining /= factor;
    }
    if (remaining !== 1n) return `${n}/${d}`;
    let remainder = n % d;
    let decimals = "";
    while (remainder !== 0n) {
      remainder *= 10n;
      decimals += remainder / d;
      remainder %= d;
    }
    return decimals ? `${n / d}.${decimals}` : `${n / d}`;
  }

  /**
   * Describes quote units per base unit, including issued-asset issuers to avoid
   * treating equal asset codes from different issuers as the same currency.
   */
  static describe(
    { price, baseAsset, quoteAsset }: DescribeStellarPriceArgs,
  ): string {
    return `${StellarPrice.format(price)} ${label(quoteAsset)} per ${
      label(baseAsset)
    }`;
  }
}

export type {
  DescribeStellarPriceArgs,
  StellarPriceRatio,
} from "@/price/types.ts";
export { ERROR_PRCE as StellarPriceErrors } from "@/price/error.ts";
