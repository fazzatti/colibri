import { ColibriError } from "@/error/index.ts";

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

export type MetaData = {
  decimals?: number;
  value?: unknown;
  fractionalDigits?: number;
  maxFractionDigits?: number;
};

export type Meta = {
  cause: Error | null;
  data: MetaData;
};

export type FormatUnitsErrorShape = {
  code: Code;
  message: string;
  data: MetaData;
  details: string;
  cause?: Error;
};

export abstract class FormatUnitsError extends ColibriError<Code, Meta> {
  override readonly source = "@colibri/core/helpers/format-units";
  override readonly domain = "helpers" as const;
  override readonly meta: Meta;

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

export class INVALID_DECIMALS extends FormatUnitsError {
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

export class EMPTY_VALUE extends FormatUnitsError {
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

export class INVALID_DECIMAL_INPUT extends FormatUnitsError {
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

export class TOO_MANY_FRACTION_DIGITS extends FormatUnitsError {
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

export class NON_FINITE_NUMBER extends FormatUnitsError {
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

export class INVALID_SCIENTIFIC_NOTATION extends FormatUnitsError {
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

export class INVALID_SCIENTIFIC_EXPONENT extends FormatUnitsError {
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

export class INVALID_MAX_FRACTION_DIGITS extends FormatUnitsError {
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
