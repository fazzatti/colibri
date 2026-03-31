import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

/** Metadata attached to event-parsing errors. */
export type Meta = {
  cause: Error | null;
  data: unknown;
};

/** Constructor payload used by concrete event-parsing errors. */
export type EventParsingErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: unknown;
};

/** Base error type for ledger-to-event parsing failures. */
export abstract class EventParsingError extends ColibriError<Code, Meta> {
  /** Stable source identifier for event parsing errors. */
  override readonly source = "@colibri/core/events/parsing";
  /** Structured metadata attached to the error. */
  override readonly meta: Meta;

  /**
   * Creates a new event-parsing error.
   *
   * @param args Error construction payload.
   */
  constructor(args: EventParsingErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "events" as const,
      source: "@colibri/core/events/parsing",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic || undefined,
      meta,
    });

    this.meta = meta;
  }
}

/** Stable error codes emitted while parsing events from ledger metadata. */
export enum Code {
  INVALID_LEDGER_CLOSE_META_XDR = "EVP_001",
  UNSUPPORTED_LEDGER_CLOSE_META_VERSION = "EVP_002",
}

/** Raised when ledger-close metadata cannot be decoded as XDR. */
export class INVALID_LEDGER_CLOSE_META_XDR extends EventParsingError {
  /** Creates the error. */
  constructor() {
    super({
      code: Code.INVALID_LEDGER_CLOSE_META_XDR,
      message: "Invalid LedgerCloseMeta XDR",
      details:
        "The provided LedgerCloseMeta XDR is invalid and cannot be parsed.",
      data: {},
    });
  }
}

/** Raised when ledger-close metadata uses an unsupported version. */
export class UNSUPPORTED_LEDGER_CLOSE_META_VERSION extends EventParsingError {
  /**
   * Creates the error.
   *
   * @param version Unsupported version number.
   */
  constructor(version: number) {
    super({
      code: Code.UNSUPPORTED_LEDGER_CLOSE_META_VERSION,
      message: "Unsupported LedgerCloseMeta version",
      details: `The provided LedgerCloseMeta version ${version} is not supported.`,
      data: { version },
    });
  }
}

/** Event-parsing error constructors indexed by stable code. */
export const ERROR_EVP = {
  [Code.INVALID_LEDGER_CLOSE_META_XDR]: INVALID_LEDGER_CLOSE_META_XDR,
  [Code.UNSUPPORTED_LEDGER_CLOSE_META_VERSION]:
    UNSUPPORTED_LEDGER_CLOSE_META_VERSION,
};
