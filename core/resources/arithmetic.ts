import type { ResourceAdjustment } from "@/common/types/transaction-config/resources.ts";
import * as ERROR from "@/resources/error.ts";

export const MAX_RESOURCE = 0xffff_ffffn;
export const RESOURCE_FIELDS = [
  "instructions",
  "diskReadBytes",
  "writeBytes",
  "resourceFee",
] as const;
export type ResourceField = typeof RESOURCE_FIELDS[number];

export function requireRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ERROR.INVALID_CONFIGURATION(field, value);
  }
  return value as Record<string, unknown>;
}

export function requireKeys(
  value: unknown,
  keys: readonly string[],
  field: string,
): void {
  const record = requireRecord(value, field);
  if (Object.keys(record).some((key) => !keys.includes(key))) {
    throw new ERROR.INVALID_CONFIGURATION(field, value);
  }
}

export function unsignedAmount(
  value: unknown,
  field: string,
  fee = false,
): bigint {
  const valid = fee
    ? typeof value === "string" && /^\d+$/.test(value)
    : typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
  if (!valid) throw new ERROR.INVALID_CONFIGURATION(field, value);
  return BigInt(value as number | string);
}

export function requireMaximum(
  value: bigint,
  maximum: bigint,
  field: string,
): void {
  if (value > maximum) throw new ERROR.LIMIT_EXCEEDED(field, value, maximum);
}

export const ceilDiv = (numerator: bigint, denominator: bigint): bigint =>
  (numerator + denominator - 1n) / denominator;

// Interpret the decimal representation supplied by the caller exactly, including
// scientific notation. Never multiply a fee by a floating-point percentage.
function percentFraction(percent: unknown, field: string): [bigint, bigint] {
  if (typeof percent !== "number" || !Number.isFinite(percent) || percent < 0) {
    throw new ERROR.INVALID_CONFIGURATION(field, percent);
  }
  const [decimal, exponent = "0"] = percent.toString().split("e");
  const [whole, fraction = ""] = decimal.split(".");
  const numerator = BigInt(whole + fraction);
  const scale = fraction.length - Number(exponent) + 2;
  return scale >= 0
    ? [numerator, 10n ** BigInt(scale)]
    : [numerator * 10n ** BigInt(-scale), 1n];
}

export function adjustmentAmount(
  base: bigint,
  adjustment: ResourceAdjustment<number | string>,
  field: string,
  fee = false,
): bigint {
  requireKeys(adjustment, ["amount", "percent"], field);
  const { amount, percent } = adjustment;
  if ((amount === undefined) === (percent === undefined)) {
    throw new ERROR.INVALID_CONFIGURATION(field, adjustment);
  }
  if (amount !== undefined) return unsignedAmount(amount, field, fee);
  const [numerator, denominator] = percentFraction(percent, field);
  return ceilDiv(base * numerator, denominator);
}
