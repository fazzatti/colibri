import { ColibriError } from "@colibri/core";

/** Stable generator, CLI and generated-client failure codes. */
export enum Code {
  INVALID_OPTIONS = "CBG_001",
  INVALID_SPEC = "CBG_002",
  SOURCE_FAILED = "CBG_003",
  OUTPUT_FAILED = "CBG_004",
  CANCELLED = "CBG_005",
  /** A submitted transaction succeeded but its return value could not be decoded. */
  RESULT_DECODE_FAILED = "CBG_006",
}
/** @internal Shared Core error base; constructor identity is preserved. */
export class BindingErrorBase extends ColibriError<Code, { cause?: unknown }> {}
/** Generator error preserving its cause and actionable context. */
export class BindingError extends BindingErrorBase {
  /** Creates a failure without discarding the underlying SDK or filesystem error. */
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
