import { ColibriError } from "../../error/index.ts";
import type { Diagnostic } from "../../error/types.ts";
import type { SimulateTransactionInput } from "./types.ts";

export enum Code {
  UNEXPECTED_ERROR = "SIM_000",
}

export type Meta = {
  cause: Error | null;
  data: {
    input: SimulateTransactionInput;
  };
};

export abstract class SimulateTransactionError extends ColibriError<
  Code,
  Meta
> {
  override readonly meta: Meta;

  constructor(args: {
    code: Code;
    message: string;
    input: SimulateTransactionInput;
    details?: string;
    diagnostic?: Diagnostic;
    cause?: Error;
  }) {
    const meta = {
      cause: args.cause || null,
      data: { input: args.input },
    };

    super({
      domain: "processes" as const,
      source: "@colibri/core/processes/build-transaction",
      code: args.code,
      message: args.message,
      details: args.details || args.message,
      diagnostic: args.diagnostic || undefined,
      meta,
    });

    this.meta = meta;
  }
}

export class UNEXPECTED_ERROR extends SimulateTransactionError {
  constructor(input: SimulateTransactionInput, cause: Error) {
    super({
      code: Code.UNEXPECTED_ERROR,
      message: "An unexpected error occurred!",
      input,
      details: cause.message,
      cause,
    });
  }
}
export const ERROR_SIM = {
  [Code.UNEXPECTED_ERROR]: UNEXPECTED_ERROR,
};
