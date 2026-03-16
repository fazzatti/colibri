import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

export type Meta<DataType> = {
  cause: Error | null;
  data: DataType;
};

export type AuthErrorShape<Code extends string, DataType> = {
  code: Code;
  message: string;
  data: DataType;
  details?: string;
  diagnostic?: Diagnostic;
  cause?: Error;
};

export abstract class AuthError<
  Code extends string,
  DataType
> extends ColibriError<Code, Meta<DataType>> {
  override readonly meta: Meta<DataType>;

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
