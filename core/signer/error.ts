import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

export type Meta<DataType> = {
  cause: Error | null;
  data: DataType;
};

export type SignerErrorShape<Code extends string, DataType> = {
  code: Code;
  message: string;
  data: DataType;
  details?: string;
  diagnostic?: Diagnostic;
  cause?: Error;
};

export abstract class SignerError<
  Code extends string,
  DataType
> extends ColibriError<Code, Meta<DataType>> {
  override readonly meta: Meta<DataType>;

  constructor(args: SignerErrorShape<Code, DataType>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "signer" as const,
      source: "@colibri/core/signer/*",
      code: args.code,
      message: args.message,
      details: args.details, // || args.message, all details handled by now
      diagnostic: args.diagnostic,
      meta,
    });

    this.meta = meta;
  }
}
