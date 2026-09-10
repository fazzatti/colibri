import { ColibriError } from "@/error/index.ts";

/** Stable errors raised by Soroban value validation and codecs. */
export enum SorobanValueErrorCode {
  INVALID_VALUE = "SV_001",
  TYPE_MISMATCH = "SV_002",
  INVALID_SCHEMA = "SV_003",
}

/** A value or schema cannot be represented by the selected Soroban type. */
export class SorobanValueError extends ColibriError<SorobanValueErrorCode> {
  /** Records the expected type and the failed representation rule. */
  constructor(
    code: SorobanValueErrorCode,
    type: string,
    reason: string,
    cause?: unknown,
  ) {
    super({
      domain: "core",
      source: "@colibri/core/values",
      code,
      message: `Invalid Soroban ${type}: ${reason}`,
      meta: { cause, data: { type, reason } },
    });
  }
}

/** @internal */
export function requireValue(
  condition: unknown,
  type: string,
  reason: string,
): asserts condition {
  if (!condition) {
    throw new SorobanValueError(
      SorobanValueErrorCode.INVALID_VALUE,
      type,
      reason,
    );
  }
}

/** @internal Local error-code alias. */
export { SorobanValueErrorCode as Code };
