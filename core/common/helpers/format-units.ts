import * as E from "@/common/helpers/format-units.error.ts";

export type DecimalInput = string | number | bigint;

export type FromDecimalsOptions = {
  /**
   * What to do if the input has more fractional digits than `decimals`.
   * - "error" (default): throw
   * - "truncate": drop extra fractional digits (towards zero)
   */
  excessFraction?: "error" | "truncate";
};

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
  opts: FromDecimalsOptions = {}
): bigint {
  if (!Number.isInteger(decimals) || decimals < 0) {
    throw new E.INVALID_DECIMALS(decimals);
  }
  if (typeof value === "bigint") return value;

  const excessFraction = opts.excessFraction ?? "error";

  const raw =
    typeof value === "number" ? numberToPlainString(value) : String(value);
  const s = raw.trim();
  if (s.length === 0) {
    throw new E.EMPTY_VALUE(raw);
  }

  const sign = s.startsWith("-") ? -1n : 1n;
  const unsigned = s.startsWith("-") || s.startsWith("+") ? s.slice(1) : s;

  const plain = expandScientific(unsigned);
  // Allow common user inputs like ".5" and "5.".
  const m = /^(\d*)(?:\.(\d*))?$/.exec(plain);
  const wholePart = m?.[1] ?? "";
  const fracPart = m?.[2] ?? "";
  if (wholePart === "" && fracPart === "") {
    throw new E.INVALID_DECIMAL_INPUT(raw);
  }

  let whole = wholePart || "0";
  let frac = fracPart;

  // normalize leading zeros in whole (keep at least one digit)
  whole = whole.replace(/^0+(?=\d)/, "");

  if (frac.length > decimals) {
    if (excessFraction === "truncate") {
      frac = frac.slice(0, decimals);
    } else {
      throw new E.TOO_MANY_FRACTION_DIGITS(raw, decimals, frac.length);
    }
  }

  const fracPadded = frac.padEnd(decimals, "0");
  const digits = (whole + fracPadded).replace(/^0+(?=\d)/, "");
  const bi = BigInt(digits);
  return sign < 0n ? -bi : bi;
}

/**
 * Convert base units bigint into a human decimal string given `decimals`.
 * Example: toDecimals(1230000n, 6) => "1.23"
 */
export function toDecimals(
  amount: bigint,
  decimals: number,
  opts: ToDecimalsOptions = {}
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
