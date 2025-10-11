import { ColibriError } from "../error/index.ts";
import type { Diagnostic } from "../error/types.ts";

export type Meta<DataType> = {
  cause: Error | null;
  data: DataType;
};

export type ToolsErrorShape<Code extends string, DataType> = {
  code: Code;
  message: string;
  data: DataType;
  details?: string;
  diagnostic?: Diagnostic;
  cause?: Error;
};

export abstract class ToolsError<
  Code extends string,
  DataType
> extends ColibriError<Code, Meta<DataType>> {
  override readonly meta: Meta<DataType>;

  constructor(args: ToolsErrorShape<Code, DataType>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "tools" as const,
      source: "@colibri/core/tools/*",
      code: args.code,
      message: args.message,
      details: args.details || args.message,
      diagnostic: args.diagnostic || undefined,
      meta,
    });

    this.meta = meta;
  }
}
