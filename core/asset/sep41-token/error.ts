import { ColibriError } from "@/error/index.ts";

/** Stable error codes raised by the SEP-41 token client. */
export enum Code {
  MISSING_RETURN_VALUE = "SEP41_TOKEN_001",
}

/** Base class for errors raised by the SEP-41 token client. */
export abstract class SEP41TokenError extends ColibriError<
  Code,
  { cause: null; data: unknown }
> {
  /** Creates a SEP-41 token client error. */
  constructor(args: {
    code: Code;
    message: string;
    details: string;
    data: unknown;
  }) {
    super({
      domain: "contract",
      source: "@colibri/core/asset/sep41-token",
      code: args.code,
      message: args.message,
      details: args.details,
      meta: { cause: null, data: args.data },
    });
  }
}

/** Raised when a standardized read returns no value. */
export class MISSING_RETURN_VALUE extends SEP41TokenError {
  /** Creates the missing-return-value error for one SEP-41 method. */
  constructor(functionName: string) {
    super({
      code: Code.MISSING_RETURN_VALUE,
      message: "Missing SEP-41 return value",
      details:
        `The SEP-41 method '${functionName}' completed without its required return value.`,
      data: { functionName },
    });
  }
}

/** Error-code-to-constructor map for SEP-41 token client errors. */
export const ERRORS_SEP41_TOKEN = {
  [Code.MISSING_RETURN_VALUE]: MISSING_RETURN_VALUE,
} as const;
