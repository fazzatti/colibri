import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";
import type { Segment } from "@/events/event-filter/types.ts";
import type { xdr } from "stellar-sdk";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type EventParsingErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: unknown;
};

export abstract class EventParsingError extends ColibriError<Code, Meta> {
  override readonly source = "@colibri/core/events/parsing";
  override readonly meta: Meta;

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

export enum Code {
  INVALID_LEDGER_CLOSE_META_XDR = "EVP_001",
  UNSUPPORTED_LEDGER_CLOSE_META_VERSION = "EVP_002",
}

export class INVALID_LEDGER_CLOSE_META_XDR extends EventParsingError {
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

export class UNSUPPORTED_LEDGER_CLOSE_META_VERSION extends EventParsingError {
  constructor(version: number) {
    super({
      code: Code.UNSUPPORTED_LEDGER_CLOSE_META_VERSION,
      message: "Unsupported LedgerCloseMeta version",
      details: `The provided LedgerCloseMeta version ${version} is not supported.`,
      data: { version },
    });
  }
}

export const ERROR_EVP = {
  [Code.INVALID_LEDGER_CLOSE_META_XDR]: INVALID_LEDGER_CLOSE_META_XDR,
  [Code.UNSUPPORTED_LEDGER_CLOSE_META_VERSION]:
    UNSUPPORTED_LEDGER_CLOSE_META_VERSION,
};
