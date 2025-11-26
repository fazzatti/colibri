import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type EventIDErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: unknown;
};

export abstract class EventIDError extends ColibriError<Code, Meta> {
  override readonly source = "@colibri/core/events/event-id";
  override readonly meta: Meta;

  constructor(args: EventIDErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "events" as const,
      source: "@colibri/core/events/event-id",
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
  EVENT_INDEX_OUT_OF_RANGE = "EVI_001",
  INVALID_EVENT_ID_FORMAT = "EVI_002",
}

export class EVENT_INDEX_OUT_OF_RANGE extends EventIDError {
  constructor(eventIndex: number) {
    super({
      code: Code.EVENT_INDEX_OUT_OF_RANGE,
      message: "Event index out of range",
      details: `The provided event index ${eventIndex} is out of the valid range  (1-9,999,999,999).`,
      data: { eventIndex },
    });
  }
}

export class INVALID_EVENT_ID_FORMAT extends EventIDError {
  constructor(eventId: string) {
    super({
      code: Code.INVALID_EVENT_ID_FORMAT,
      message: "Invalid Event ID format",
      details: `The provided Event ID ${eventId} does not match the expected format.`,
      data: { eventId },
    });
  }
}

export const ERROR_EVI = {
  [Code.EVENT_INDEX_OUT_OF_RANGE]: EVENT_INDEX_OUT_OF_RANGE,
  [Code.INVALID_EVENT_ID_FORMAT]: INVALID_EVENT_ID_FORMAT,
};
