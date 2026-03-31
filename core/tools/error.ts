import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

/** Metadata attached to tool-related errors. */
export type Meta<DataType> = {
  cause: Error | null;
  data: DataType;
};

/** Constructor payload used by concrete tools errors. */
export type ToolsErrorShape<Code extends string, DataType> = {
  code: Code;
  message: string;
  data: DataType;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
};

/** Base error type for tool helpers. */
export abstract class ToolsError<
  Code extends string,
  DataType
> extends ColibriError<Code, Meta<DataType>> {
  /** Structured metadata attached to the error. */
  override readonly meta: Meta<DataType>;

  /**
   * Creates a new tools error.
   *
   * @param args Error construction payload.
   */
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
      details: args.details,
      diagnostic: args.diagnostic || undefined,
      meta,
    });

    this.meta = meta;
  }
}
