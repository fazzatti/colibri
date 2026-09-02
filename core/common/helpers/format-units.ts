import * as E from "@/common/helpers/format-units.error.ts";

/** Decimal-like inputs accepted by unit conversion helpers. */
export type DecimalInput = string | number | bigint;

/** Options for converting human-readable decimals into base units. */
export type FromDecimalsOptions = {
  /**
   * What to do if the input has more fractional digits than `decimals`.
   * - "error" (default): throw
   * - "truncate": drop extra fractional digits (towards zero)
   */
  excessFraction?: "error" | "truncate";
};

/** Options for converting base units into human-readable decimals. */
export type ToDecimalsOptions = {
  /** Remove trailing zeros in the fractional part (default: true). */
  trimTrailingZeros?: boolean;
  /** If set, cap the fractional digits to this many (no rounding; just truncation). */
  maxFractionDigits?: number;
};

/**
 * Convert a human decimal value (e.g. "1.23") into base units bigint given `decimals`.
 * Example: fromDecimals("1.23", 6) => 1230000n
 */
export function fromDecimals(
  value: DecimalInput,
  decimals: number,
  opts: FromDecimalsOptions = {},
): bigint {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new E.INVALID_DECIMALS(decimals);
  }
  if (typeof value === "bigint") return value;

  const raw = typeof value === "number"
    ? numberToPlainString(value)
    : String(value);
  const { sign, whole, fraction } = parseDecimalParts(raw);
  const frac = normalizeFraction(
    fraction,
    decimals,
    opts.excessFraction ?? "error",
    raw,
  );

  const fracPadded = frac.padEnd(decimals, "0");
  const digits = (whole + fracPadded).replace(/^0+(?=\d)/, "");
  const bi = BigInt(digits);
  return sign < 0n ? -bi : bi;
}

const parseDecimalParts = (
  raw: string,
): { sign: bigint; whole: string; fraction: string } => {
  const value = raw.trim();
  if (value.length === 0) throw new E.EMPTY_VALUE(raw);

  const sign = value.startsWith("-") ? -1n : 1n;
  const unsigned = value.startsWith("-") || value.startsWith("+")
    ? value.slice(1)
    : value;
  const match = /^(\d*)(?:\.(\d*))?$/.exec(expandScientific(unsigned));
  const whole = match?.[1] ?? "";
  const fraction = match?.[2] ?? "";
  if (whole === "" && fraction === "") {
    throw new E.INVALID_DECIMAL_INPUT(raw);
  }

  return {
    sign,
    whole: (whole || "0").replace(/^0+(?=\d)/, ""),
    fraction,
  };
};

const normalizeFraction = (
  fraction: string,
  decimals: number,
  excessFraction: NonNullable<FromDecimalsOptions["excessFraction"]>,
  raw: string,
): string => {
  if (fraction.length <= decimals) return fraction;
  if (excessFraction === "truncate") return fraction.slice(0, decimals);
  throw new E.TOO_MANY_FRACTION_DIGITS(raw, decimals, fraction.length);
};

/**
 * Convert base units bigint into a human decimal string given `decimals`.
 * Example: toDecimals(1230000n, 6) => "1.23"
 */
export function toDecimals(
  amount: bigint,
  decimals: number,
  opts: ToDecimalsOptions = {},
): string {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new E.INVALID_DECIMALS(decimals);
  }

  const trimTrailingZeros = opts.trimTrailingZeros ?? true;

  const sign = amount < 0n ? "-" : "";
  const abs = amount < 0n ? -amount : amount;

  if (decimals === 0) return `${sign}${abs.toString()}`;

  const s = abs.toString();
  const pad = decimals + 1;
  const padded = s.length >= pad ? s : s.padStart(pad, "0");

  const cut = padded.length - decimals;
  const whole = padded.slice(0, cut);
  let frac = padded.slice(cut);

  if (opts.maxFractionDigits != null) {
    if (
      !Number.isInteger(opts.maxFractionDigits) ||
      opts.maxFractionDigits < 0
    ) {
      throw new E.INVALID_MAX_FRACTION_DIGITS(opts.maxFractionDigits);
    }
    frac = frac.slice(0, opts.maxFractionDigits);
  }

  if (trimTrailingZeros) {
    frac = frac.replace(/0+$/, "");
  }

  return frac.length ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
}

/** Turns numbers into a deterministic string; rejects non-finite values. */
function numberToPlainString(n: number): string {
  if (!Number.isFinite(n)) {
    throw new E.NON_FINITE_NUMBER(n);
  }
  // Keep as-is; if it becomes scientific notation, expandScientific() will handle it.
  return n.toString();
}

/**
 * Expand scientific notation like "1e-6" or "1.23E+4" into a plain decimal string.
 * Leaves non-scientific strings untouched.
 */
function expandScientific(s: string): string {
  if (!/[eE]/.test(s)) return s;

  const m = /^(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(s);
  if (!m) {
    throw new E.INVALID_SCIENTIFIC_NOTATION(s);
  }

  const intPart = m[1];
  const fracPart = m[2] ?? "";
  const exp = Number(m[3]);

  if (!Number.isInteger(exp)) {
    throw new E.INVALID_SCIENTIFIC_EXPONENT(s);
  }

  // Prevent pathological inputs (e.g. 1e999999999) from exploding memory or
  // throwing RangeError via String.repeat(). Treat these as invalid.
  const MAX_EXPONENT_ABS = 1_000_000;
  if (Math.abs(exp) > MAX_EXPONENT_ABS) {
    throw new E.INVALID_SCIENTIFIC_EXPONENT(s);
  }

  const digits = intPart + fracPart;
  const decPos = intPart.length; // decimal position in `digits` before exponent shift
  const newPos = decPos + exp;

  if (newPos <= 0) {
    // 0.[zeros]digits
    return `0.${"0".repeat(-newPos)}${digits}`;
  }

  if (newPos >= digits.length) {
    // digits[zeros]
    return `${digits}${"0".repeat(newPos - digits.length)}`;
  }

  // split digits at newPos
  return `${digits.slice(0, newPos)}.${digits.slice(newPos)}`;
}
