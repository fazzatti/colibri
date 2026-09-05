import { ColibriError } from "@/error/index.ts";

/** Stable errors for exact Stellar prices. */
export enum Code {
  INVALID_DECIMAL = "PRCE_001",
  NON_POSITIVE_DECIMAL = "PRCE_002",
  UNREPRESENTABLE_DECIMAL = "PRCE_003",
  INVALID_RATIO = "PRCE_004",
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

/** Exact-price errors indexed by stable code. */
export const ERROR_PRCE = {
  [Code.INVALID_DECIMAL]: INVALID_DECIMAL,
  [Code.NON_POSITIVE_DECIMAL]: NON_POSITIVE_DECIMAL,
  [Code.UNREPRESENTABLE_DECIMAL]: UNREPRESENTABLE_DECIMAL,
  [Code.INVALID_RATIO]: INVALID_RATIO,
};
