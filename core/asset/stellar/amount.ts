import { fromDecimals, toDecimals } from "@/common/helpers/format-units.ts";
import * as E from "@/asset/stellar/amount.error.ts";

const MAX_UNITS = 9_223_372_036_854_775_807n;

/** Exact asset quantities, not arbitrary contract-token units. @internal */
export function parseStellarAssetAmount(value: string): bigint {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw new E.INVALID_DECIMAL(value);
  }
  const [whole, rawFraction = ""] = value.split(".");
  const fraction = rawFraction.replace(/0+$/, "");
  if (fraction.length > 7) throw new E.EXCESS_PRECISION(value);
  const units = fromDecimals(fraction ? `${whole}.${fraction}` : whole, 7);
  if (units > MAX_UNITS) throw new E.DECIMAL_OVERFLOW(value);
  return units;
}

/** Asset-specific bounds around the shared decimal formatter. @internal */
export function formatStellarAssetAmount(units: bigint): string {
  if (typeof units !== "bigint" || units < 0n || units > MAX_UNITS) {
    throw new E.INVALID_UNITS(units);
  }
  return toDecimals(units, 7);
}
