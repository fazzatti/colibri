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
  /** @deprecated Use a dedicated failure subclass; this constructor is retained for source compatibility. */
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
    throw new SorobanInvalidValueError(type, reason);
  }
}

/** @internal Local error-code alias. */
export { SorobanValueErrorCode as Code };

/** Invalid value. Stable code `SV_001`. */
export class SorobanInvalidValueError extends SorobanValueError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(type: string, reason: string, cause?: unknown) {
    super(SorobanValueErrorCode.INVALID_VALUE, type, reason, cause);
  }
}
/** Type mismatch. Stable code `SV_002`. */
export class SorobanTypeMismatchError extends SorobanValueError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(type: string, reason: string, cause?: unknown) {
    super(SorobanValueErrorCode.TYPE_MISMATCH, type, reason, cause);
  }
}
/** Invalid schema. Stable code `SV_003`. */
export class SorobanInvalidSchemaError extends SorobanValueError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(type: string, reason: string, cause?: unknown) {
    super(SorobanValueErrorCode.INVALID_SCHEMA, type, reason, cause);
  }
}
/** One concrete constructor for each stable Soroban error code. */
export const SorobanErrors: {
  [SorobanValueErrorCode.INVALID_VALUE]: typeof SorobanInvalidValueError;
  [SorobanValueErrorCode.TYPE_MISMATCH]: typeof SorobanTypeMismatchError;
  [SorobanValueErrorCode.INVALID_SCHEMA]: typeof SorobanInvalidSchemaError;
} = {
  [SorobanValueErrorCode.INVALID_VALUE]: SorobanInvalidValueError,
  [SorobanValueErrorCode.TYPE_MISMATCH]: SorobanTypeMismatchError,
  [SorobanValueErrorCode.INVALID_SCHEMA]: SorobanInvalidSchemaError,
};
