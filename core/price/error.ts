import { ColibriError } from "@/error/index.ts";

/** Stable errors for exact Stellar prices. */
export enum Code {
  INVALID_DECIMAL = "PRCE_001",
  NON_POSITIVE_DECIMAL = "PRCE_002",
  UNREPRESENTABLE_DECIMAL = "PRCE_003",
  INVALID_RATIO = "PRCE_004",
  ZERO_PRICE_AMOUNT = "PRCE_005",
  UNREPRESENTABLE_AMOUNTS = "PRCE_006",
}

/** Decimal price text does not use the documented plain decimal syntax. */
export class INVALID_DECIMAL extends ColibriError<Code.INVALID_DECIMAL> {
  /** Records the rejected price. */
  constructor(value: unknown) {
    super({
      domain: "core",
      source: "@colibri/core/price",
      code: Code.INVALID_DECIMAL,
      message:
        "Price must be a plain unsigned decimal string, without exponent notation.",
      meta: { data: { value } },
    });
  }
}

/** A decimal price must be strictly positive. */
export class NON_POSITIVE_DECIMAL
  extends ColibriError<Code.NON_POSITIVE_DECIMAL> {
  /** Records the rejected price. */
  constructor(value: string) {
    super({
      domain: "core",
      source: "@colibri/core/price",
      code: Code.NON_POSITIVE_DECIMAL,
      message: "Price must be greater than zero.",
      meta: { data: { value } },
    });
  }
}

/** No exact positive int32 fraction represents the supplied decimal. */
export class UNREPRESENTABLE_DECIMAL
  extends ColibriError<Code.UNREPRESENTABLE_DECIMAL> {
  /** Records the price without silently weakening its bound. */
  constructor(value: string) {
    super({
      domain: "core",
      source: "@colibri/core/price",
      code: Code.UNREPRESENTABLE_DECIMAL,
      message:
        "Price cannot be represented exactly by Stellar's positive int32 numerator and denominator.",
      meta: { data: { value } },
    });
  }
}

/** A price fraction has a non-positive or out-of-range integer component. */
export class INVALID_RATIO extends ColibriError<Code.INVALID_RATIO> {
  /** Records the rejected fraction. */
  constructor(value: unknown) {
    super({
      domain: "core",
      source: "@colibri/core/price",
      code: Code.INVALID_RATIO,
      message:
        "Price numerator and denominator must be positive int32 integers.",
      meta: { data: { value } },
    });
  }
}

/** A quantity-based exchange price requires two positive amounts. */
export class ZERO_PRICE_AMOUNT extends ColibriError<Code.ZERO_PRICE_AMOUNT> {
  /** Explains the invalid zero quantity. */
  constructor() {
    super({
      domain: "core",
      source: "@colibri/core/price",
      code: Code.ZERO_PRICE_AMOUNT,
      message: "Both base and quote amounts must be greater than zero.",
    });
  }
}
/** Exact quantity conversion would exceed the native price component range. */
export class UNREPRESENTABLE_AMOUNTS
  extends ColibriError<Code.UNREPRESENTABLE_AMOUNTS> {
  /** Retains the two quantities without approximating their exchange rate. */
  constructor(baseAmount: string, quoteAmount: string) {
    super({
      domain: "core",
      source: "@colibri/core/price",
      code: Code.UNREPRESENTABLE_AMOUNTS,
      message:
        "The exact quantity ratio exceeds Stellar's positive int32 price range.",
      meta: { data: { baseAmount, quoteAmount } },
    });
  }
}

/** Exact-price errors indexed by stable code. */
export const ERROR_PRCE = {
  [Code.INVALID_DECIMAL]: INVALID_DECIMAL,
  [Code.NON_POSITIVE_DECIMAL]: NON_POSITIVE_DECIMAL,
  [Code.UNREPRESENTABLE_DECIMAL]: UNREPRESENTABLE_DECIMAL,
  [Code.INVALID_RATIO]: INVALID_RATIO,
  [Code.ZERO_PRICE_AMOUNT]: ZERO_PRICE_AMOUNT,
  [Code.UNREPRESENTABLE_AMOUNTS]: UNREPRESENTABLE_AMOUNTS,
};
