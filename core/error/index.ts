import type {
  BaseMeta,
  ColibriErrorShape,
  Diagnostic,
  ErrorDomain,
} from "@/error/types.ts";

export class ColibriError<
  C extends string = string,
  M extends BaseMeta = BaseMeta
> extends Error {
  readonly domain: ErrorDomain;
  readonly code: C;
  readonly source: string;
  readonly details?: string;
  readonly diagnostic?: Diagnostic;
  readonly meta?: M;

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

  static is(e: unknown): e is ColibriError<string, BaseMeta> {
    return e instanceof ColibriError;
  }

  static unexpected(args?: {
    domain?: ErrorDomain;
    source?: string;
    code?: string;
    message?: string;
    details?: string;
    meta?: BaseMeta;
    cause?: unknown;
  }): ColibriError {
    return new ColibriError({
      domain: args?.domain ?? "core",
      source: args?.source ?? "colibri",
      code: (args?.code ?? "GEN_000") as string,
      message: args?.message ?? "Unexpected error",
      details: args?.details ?? "An unexpected error occurred",
      meta: { ...args?.meta, cause: args?.cause },
    });
  }

  static fromUnknown(
    error: unknown,
    ctx?: Partial<ColibriErrorShape<string, BaseMeta>>
  ): ColibriError {
    if (error instanceof ColibriError) return error;
    if (error instanceof Error) {
      return new ColibriError({
        domain: ctx?.domain ?? "core",
        source: ctx?.source ?? "colibri",
        code: ctx?.code ?? "GEN_000",
        message: error.message,
        details: ctx?.details ?? error.stack,
        diagnostic: ctx?.diagnostic,
        meta: { ...ctx?.meta, cause: error },
      });
    }
    return ColibriError.unexpected({ cause: error, ...ctx });
  }
}
