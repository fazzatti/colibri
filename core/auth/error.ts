import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

/** Metadata attached to auth-related errors. */
export type Meta<DataType> = {
  cause: Error | null;
  data: DataType;
};

/** Constructor payload used by concrete auth errors. */
export type AuthErrorShape<Code extends string, DataType> = {
  code: Code;
  message: string;
  data: DataType;
  details?: string;
  diagnostic?: Diagnostic;
  cause?: Error;
};

/** Base error type for auth helpers and requirements. */
export abstract class AuthError<
  Code extends string,
  DataType
> extends ColibriError<Code, Meta<DataType>> {
  /** Structured metadata attached to the error. */
  override readonly meta: Meta<DataType>;

  /**
   * Creates a new auth error.
   *
   * @param args Error construction payload.
   */
  constructor(args: AuthErrorShape<Code, DataType>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "auth" as const,
      source: "@colibri/core/auth/*",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic,
      meta,
    });

    this.meta = meta;
  }
}
