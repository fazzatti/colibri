import { ColibriError } from "@/error/index.ts";

/**
 * Stable error codes emitted by the format-units helper.
 */
export enum Code {
  INVALID_DECIMALS = "HLP_UNT_01",
  EMPTY_VALUE = "HLP_UNT_02",
  INVALID_DECIMAL_INPUT = "HLP_UNT_03",
  TOO_MANY_FRACTION_DIGITS = "HLP_UNT_04",
  NON_FINITE_NUMBER = "HLP_UNT_05",
  INVALID_SCIENTIFIC_NOTATION = "HLP_UNT_06",
  INVALID_SCIENTIFIC_EXPONENT = "HLP_UNT_07",
  INVALID_MAX_FRACTION_DIGITS = "HLP_UNT_08",
}

/**
 * Structured helper-specific metadata carried by format-units errors.
 */
export type MetaData = {
  decimals?: number;
  value?: unknown;
  fractionalDigits?: number;
  maxFractionDigits?: number;
};

/**
 * Metadata carried by format-units helper errors.
 */
export type Meta = {
  cause: Error | null;
  data: MetaData;
};

/**
 * Constructor shape accepted by {@link FormatUnitsError}.
 */
export type FormatUnitsErrorShape = {
  code: Code;
  message: string;
  data: MetaData;
  details: string;
  cause?: Error;
};

/**
 * Base class for format-units helper errors.
 */
export abstract class FormatUnitsError extends ColibriError<Code, Meta> {
  /** Source identifier for format-units helper failures. */
  override readonly source = "@colibri/core/helpers/format-units";
  /** Error domain for format-units helper failures. */
  override readonly domain = "helpers" as const;
  /** Structured metadata carried by the helper error. */
  override readonly meta: Meta;

  /**
   * Creates a format-units helper error.
   *
   * @param args - Error payload and structured metadata.
   */
  constructor(args: FormatUnitsErrorShape) {
    const meta: Meta = {
      cause: args.cause ?? null,
      data: args.data,
    };

    super({
      domain: "helpers",
      source: "@colibri/core/helpers/format-units",
      code: args.code,
      message: args.message,
      details: args.details,
      meta,
    });

    this.meta = meta;
  }
}

/**
 * Raised when the decimals argument is not a non-negative integer.
 */
export class INVALID_DECIMALS extends FormatUnitsError {
  /**
   * Creates an invalid-decimals error.
   *
   * @param decimals - Invalid decimals value.
   */
  constructor(decimals: number) {
    super({
      code: Code.INVALID_DECIMALS,
      message: `decimals must be a non-negative integer; got ${decimals}`,
      data: { decimals },
      details:
        "The decimals parameter must be an integer >= 0. This value determines the scale factor 10^decimals.",
    });
  }
}

/**
 * Raised when the value to format is empty.
 */
export class EMPTY_VALUE extends FormatUnitsError {
  /**
   * Creates an empty-value error.
   *
   * @param value - Invalid value.
   */
  constructor(value: unknown) {
    super({
      code: Code.EMPTY_VALUE,
      message: "value is empty",
      data: { value },
      details:
        "An empty string (or whitespace-only string) cannot be converted into base units.",
    });
  }
}

/**
 * Raised when the input cannot be parsed as a decimal value.
 */
export class INVALID_DECIMAL_INPUT extends FormatUnitsError {
  /**
   * Creates an invalid-decimal-input error.
   *
   * @param value - Invalid decimal input.
   */
  constructor(value: unknown) {
    super({
      code: Code.INVALID_DECIMAL_INPUT,
      message: `Invalid decimal input: ${String(value)}`,
      data: { value },
      details:
        "The input must be a valid decimal string (optionally signed, optionally scientific notation) containing digits and an optional decimal point.",
    });
  }
}

/**
 * Raised when the value has more fractional digits than allowed.
 */
export class TOO_MANY_FRACTION_DIGITS extends FormatUnitsError {
  /**
   * Creates a too-many-fraction-digits error.
   *
   * @param value - Original input value.
   * @param decimals - Supported decimals count.
   * @param fractionalDigits - Actual fractional digit count.
   */
  constructor(value: unknown, decimals: number, fractionalDigits: number) {
    super({
      code: Code.TOO_MANY_FRACTION_DIGITS,
      message: `Too many fractional digits: got ${fractionalDigits}, max is ${decimals}`,
      data: { value, decimals, fractionalDigits },
      details:
        "The input has more fractional digits than the asset supports. Pass excessFraction='truncate' to drop extra digits, or reduce precision.",
    });
  }
}

/**
 * Raised when a numeric input is not finite.
 */
export class NON_FINITE_NUMBER extends FormatUnitsError {
  /**
   * Creates a non-finite-number error.
   *
   * @param value - Invalid numeric input.
   */
  constructor(value: number) {
    super({
      code: Code.NON_FINITE_NUMBER,
      message: `Non-finite number: ${value}`,
      data: { value },
      details:
        "The numeric input must be a finite JavaScript number (not NaN, Infinity, or -Infinity).",
    });
  }
}

/**
 * Raised when scientific notation is malformed.
 */
export class INVALID_SCIENTIFIC_NOTATION extends FormatUnitsError {
  /**
   * Creates an invalid-scientific-notation error.
   *
   * @param value - Invalid scientific notation string.
   */
  constructor(value: string) {
    super({
      code: Code.INVALID_SCIENTIFIC_NOTATION,
      message: `Invalid scientific notation: ${value}`,
      data: { value },
      details:
        "Scientific notation must match the pattern like '1e6' or '1.23E-4'.",
    });
  }
}

/**
 * Raised when a scientific-notation exponent is invalid.
 */
export class INVALID_SCIENTIFIC_EXPONENT extends FormatUnitsError {
  /**
   * Creates an invalid-scientific-exponent error.
   *
   * @param value - Invalid scientific notation string.
   */
  constructor(value: string) {
    super({
      code: Code.INVALID_SCIENTIFIC_EXPONENT,
      message: `Invalid exponent in: ${value}`,
      data: { value },
      details:
        "The exponent portion of a scientific-notation number must be an integer within the allowed range.",
    });
  }
}

/**
 * Raised when `maxFractionDigits` is not a non-negative integer.
 */
export class INVALID_MAX_FRACTION_DIGITS extends FormatUnitsError {
  /**
   * Creates an invalid-max-fraction-digits error.
   *
   * @param maxFractionDigits - Invalid fraction digit limit.
   */
  constructor(maxFractionDigits: number) {
    super({
      code: Code.INVALID_MAX_FRACTION_DIGITS,
      message: `maxFractionDigits must be a non-negative integer; got ${maxFractionDigits}`,
      data: { maxFractionDigits },
      details:
        "maxFractionDigits controls how many fractional digits are kept when formatting. It must be an integer >= 0.",
    });
  }
}

/**
 * Format-units helper errors indexed by stable code.
 */
export const ERROR_HLP_UNT = {
  [Code.INVALID_DECIMALS]: INVALID_DECIMALS,
  [Code.EMPTY_VALUE]: EMPTY_VALUE,
  [Code.INVALID_DECIMAL_INPUT]: INVALID_DECIMAL_INPUT,
  [Code.TOO_MANY_FRACTION_DIGITS]: TOO_MANY_FRACTION_DIGITS,
  [Code.NON_FINITE_NUMBER]: NON_FINITE_NUMBER,
  [Code.INVALID_SCIENTIFIC_NOTATION]: INVALID_SCIENTIFIC_NOTATION,
  [Code.INVALID_SCIENTIFIC_EXPONENT]: INVALID_SCIENTIFIC_EXPONENT,
  [Code.INVALID_MAX_FRACTION_DIGITS]: INVALID_MAX_FRACTION_DIGITS,
};
