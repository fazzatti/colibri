import type {
  BaseMeta,
  ColibriErrorShape,
  Diagnostic,
  ErrorDomain,
} from "@/error/types.ts";

/**
 * Base error type used across Colibri packages.
 *
 * @typeParam C - Stable error code type.
 * @typeParam M - Structured metadata carried by the error.
 */
export class ColibriError<
  C extends string = string,
  M extends BaseMeta = BaseMeta,
> extends Error {
  /** High-level Colibri error domain. */
  readonly domain: ErrorDomain;
  /** Stable Colibri error code. */
  readonly code: C;
  /** Source module identifier. */
  readonly source: string;
  /** Human-readable details supplementing the message. */
  readonly details?: string;
  /** Optional troubleshooting guidance. */
  readonly diagnostic?: Diagnostic;
  /** Structured metadata carried by the error. */
  readonly meta?: M;

  /**
   * Creates a new Colibri error.
   *
   * @param e - Error payload and metadata.
   */
  constructor(e: ColibriErrorShape<C, M>) {
    super(e.message);
    this.name = "ColibriError " + e.code;
    this.domain = e.domain;
    this.code = e.code;
    this.source = e.source;
    this.details = e.details;
    this.diagnostic = e.diagnostic;
    this.meta = e.meta;
  }

  /**
   * Serializes the error into a JSON-safe object.
   *
   * @returns Serializable Colibri error data.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      domain: this.domain,
      code: this.code,
      message: this.message,
      source: this.source,
      details: this.details,
      diagnostic: this.diagnostic,
      meta: this.meta,
    };
  }

  /**
   * Returns `true` when a value is a {@link ColibriError}.
   *
   * @param e - Candidate value.
   * @returns Whether the value is a Colibri error instance.
   */
  static is(e: unknown): e is ColibriError<string, BaseMeta> {
    return e instanceof ColibriError;
  }

  /**
   * Creates a generic unexpected Colibri error.
   *
   * @param args - Optional contextual data for the generated error.
   * @returns A generic unexpected Colibri error instance.
   */
  static unexpected(args?: {
    domain?: ErrorDomain;
    source?: string;
    code?: string;
    message?: string;
    details?: string;
    meta?: BaseMeta;
    cause?: unknown;
  }): ColibriError {
    const Failure = (args?.code ?? "GEN_000") === "GEN_000"
      ? UnexpectedError
      : ColibriError;
    const payload: ColibriErrorShape<string, BaseMeta> = {
      domain: args?.domain ?? "core",
      source: args?.source ?? "colibri",
      code: (args?.code ?? "GEN_000") as string,
      message: args?.message ?? "Unexpected error",
      details: args?.details ?? "An unexpected error occurred",
      meta: { ...args?.meta, cause: args?.cause },
    };
    return new Failure(payload);
  }

  /**
   * Normalizes an unknown thrown value into a {@link ColibriError}.
   *
   * @param error - Unknown thrown value.
   * @param ctx - Optional contextual overrides for the generated error.
   * @returns A normalized Colibri error instance.
   */
  static fromUnknown(
    error: unknown,
    ctx?: Partial<ColibriErrorShape<string, BaseMeta>>,
  ): ColibriError {
    if (error instanceof ColibriError) return error;
    if (error instanceof Error) {
      const Failure = (ctx?.code ?? "GEN_000") === "GEN_000"
        ? UnexpectedError
        : ColibriError;
      const payload: ColibriErrorShape<string, BaseMeta> = {
        domain: ctx?.domain ?? "core",
        source: ctx?.source ?? "colibri",
        code: ctx?.code ?? "GEN_000",
        message: error.message,
        details: ctx?.details ?? error.stack,
        diagnostic: ctx?.diagnostic,
        meta: { ...ctx?.meta, cause: error },
      };
      return new Failure(payload);
    }
    return ColibriError.unexpected({ cause: error, ...ctx });
  }
}

/** Stable fallback for an unexpected failure without a domain-specific code. */
export enum GeneralCode {
  /** Unexpected boundary failure. */
  UNEXPECTED = "GEN_000",
}
/** Unexpected fallback failure. Library-owned failures should prefer a domain-specific subclass. */
export class UnexpectedError extends ColibriError<GeneralCode.UNEXPECTED> {
  /** Preserve context while fixing the general fallback code. */
  constructor(context: Omit<ColibriErrorShape<string, BaseMeta>, "code">) {
    super({ ...context, code: GeneralCode.UNEXPECTED });
  }
}
