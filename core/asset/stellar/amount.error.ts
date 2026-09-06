import { ColibriError } from "@/error/index.ts";

/** Exact native asset amount conversion failures. */
export enum Code {
  INVALID_DECIMAL = "AMNT_001",
  EXCESS_PRECISION = "AMNT_002",
  DECIMAL_OVERFLOW = "AMNT_003",
  INVALID_UNITS = "AMNT_004",
}

/** An amount must be expressed as nonnegative plain decimal text. */
export class INVALID_DECIMAL extends ColibriError<Code.INVALID_DECIMAL> {
  /** Records invalid input without rounding or numeric coercion. */
  constructor(value: unknown) {
    super({
      domain: "core",
      source: "@colibri/core/asset/stellar/amount",
      code: Code.INVALID_DECIMAL,
      message: "Amount must be a nonnegative plain decimal string.",
      meta: { data: { value } },
    });
  }
}
/** A decimal would lose information at native seven-decimal precision. */
export class EXCESS_PRECISION extends ColibriError<Code.EXCESS_PRECISION> {
  /** Identifies a value requiring rounding. */
  constructor(value: string) {
    super({
      domain: "core",
      source: "@colibri/core/asset/stellar/amount",
      code: Code.EXCESS_PRECISION,
      message: "Amount exceeds seven decimal places; no rounding is performed.",
      meta: { data: { value } },
    });
  }
}
/** An exact decimal amount exceeds the native signed-64-bit quantity range. */
export class DECIMAL_OVERFLOW extends ColibriError<Code.DECIMAL_OVERFLOW> {
  /** Identifies the overflowing decimal. */
  constructor(value: string) {
    super({
      domain: "core",
      source: "@colibri/core/asset/stellar/amount",
      code: Code.DECIMAL_OVERFLOW,
      message: "Amount exceeds the native signed-64-bit range.",
      meta: { data: { value } },
    });
  }
}
/** Formatting requires nonnegative signed-64-bit integer units. */
export class INVALID_UNITS extends ColibriError<Code.INVALID_UNITS> {
  /** Identifies invalid or overflowing integer units. */
  constructor(value: unknown) {
    super({
      domain: "core",
      source: "@colibri/core/asset/stellar/amount",
      code: Code.INVALID_UNITS,
      message: "Amount units must be a nonnegative signed-64-bit bigint.",
      meta: { data: { value } },
    });
  }
}

/** Amount errors indexed by stable code. */
export const ERROR_AMNT = {
  [Code.INVALID_DECIMAL]: INVALID_DECIMAL,
  [Code.EXCESS_PRECISION]: EXCESS_PRECISION,
  [Code.DECIMAL_OVERFLOW]: DECIMAL_OVERFLOW,
  [Code.INVALID_UNITS]: INVALID_UNITS,
};
