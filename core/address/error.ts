import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

/** Metadata attached to address-related errors. */
export type Meta<DataType> = {
  cause: Error | null;
  data: DataType;
};

/** Constructor payload used by concrete address errors. */
export type AddressErrorShape<Code extends string, DataType> = {
  code: Code;
  message: string;
  data: DataType;
  details?: string;
  diagnostic?: Diagnostic;
  cause?: Error;
};

/** Base error type for address helpers. */
export abstract class AddressError<
  Code extends string,
  DataType
> extends ColibriError<Code, Meta<DataType>> {
  /** Structured metadata attached to the error. */
  override readonly meta: Meta<DataType>;

  /**
   * Creates a new address error.
   *
   * @param args Error construction payload.
   */
  constructor(args: AddressErrorShape<Code, DataType>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "address" as const,
      source: "@colibri/core/address/*",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic,
      meta,
    });

    this.meta = meta;
  }
}
