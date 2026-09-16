import { ColibriError } from "@colibri/core";

/** Stable generator and CLI failure codes. */
export enum Code {
  INVALID_OPTIONS = "CBG_001",
  INVALID_SPEC = "CBG_002",
  SOURCE_FAILED = "CBG_003",
  OUTPUT_FAILED = "CBG_004",
  CANCELLED = "CBG_005",
}
/** @internal Shared Core error base; constructor identity is preserved. */
export class BindingErrorBase extends ColibriError<Code, { cause?: unknown }> {}
/** Generator error preserving its cause and actionable context. */
export class BindingError extends BindingErrorBase {
  /** Creates a failure without discarding the underlying SDK or filesystem error. */
  /** @deprecated Use a dedicated failure subclass; this constructor is retained for source compatibility. */
  constructor(code: Code, message: string, cause?: unknown) {
    super({
      domain: "tools",
      source: "@colibri/contract-bindings",
      code,
      message,
      details:
        "Check the source, generation options and output path. No transaction is submitted by this tool.",
      meta: { cause },
    });
  }
}
/** Stable error namespace. */
export const BINDING_ERRORS: {
  BindingError: typeof BindingError;
  Code: typeof Code;
} = { BindingError, Code };

/** Invalid options. Stable code `CBG_001`. */
export class BindingInvalidOptionsError extends BindingError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, cause?: unknown) {
    super(Code.INVALID_OPTIONS, message, cause);
  }
}
/** Invalid spec. Stable code `CBG_002`. */
export class BindingInvalidSpecError extends BindingError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, cause?: unknown) {
    super(Code.INVALID_SPEC, message, cause);
  }
}
/** Source failed. Stable code `CBG_003`. */
export class BindingSourceFailedError extends BindingError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, cause?: unknown) {
    super(Code.SOURCE_FAILED, message, cause);
  }
}
/** Output failed. Stable code `CBG_004`. */
export class BindingOutputFailedError extends BindingError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, cause?: unknown) {
    super(Code.OUTPUT_FAILED, message, cause);
  }
}
/** Cancelled. Stable code `CBG_005`. */
export class BindingCancelledError extends BindingError {
  /** Preserve failure context with a fixed, non-overridable code. */
  constructor(message: string, cause?: unknown) {
    super(Code.CANCELLED, message, cause);
  }
}
/** One concrete constructor for each stable Binding error code. */
export const BindingErrors: {
  [Code.INVALID_OPTIONS]: typeof BindingInvalidOptionsError;
  [Code.INVALID_SPEC]: typeof BindingInvalidSpecError;
  [Code.SOURCE_FAILED]: typeof BindingSourceFailedError;
  [Code.OUTPUT_FAILED]: typeof BindingOutputFailedError;
  [Code.CANCELLED]: typeof BindingCancelledError;
} = {
  [Code.INVALID_OPTIONS]: BindingInvalidOptionsError,
  [Code.INVALID_SPEC]: BindingInvalidSpecError,
  [Code.SOURCE_FAILED]: BindingSourceFailedError,
  [Code.OUTPUT_FAILED]: BindingOutputFailedError,
  [Code.CANCELLED]: BindingCancelledError,
};
