import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";

/** Metadata attached to event-id errors. */
export type Meta = {
  cause: Error | null;
  data: unknown;
};

/** Constructor payload used by concrete event-id errors. */
export type EventIDErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;
  cause?: Error;
  data: unknown;
};

/** Base error type for event id parsing and validation failures. */
export abstract class EventIDError extends ColibriError<Code, Meta> {
  /** Stable source identifier for event-id errors. */
  override readonly source = "@colibri/core/events/event-id";
  /** Structured metadata attached to the error. */
  override readonly meta: Meta;

  /**
   * Creates a new event-id error.
   *
   * @param args Error construction payload.
   */
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

/** Stable error codes emitted by event-id helpers. */
export enum Code {
  EVENT_INDEX_OUT_OF_RANGE = "EVI_001",
  INVALID_EVENT_ID_FORMAT = "EVI_002",
}

/** Raised when the event segment of an event id exceeds the supported range. */
export class EVENT_INDEX_OUT_OF_RANGE extends EventIDError {
  /**
   * Creates the error.
   *
   * @param eventIndex Invalid event index.
   */
  constructor(eventIndex: number) {
    super({
      code: Code.EVENT_INDEX_OUT_OF_RANGE,
      message: "Event index out of range",
      details: `The provided event index ${eventIndex} is out of the valid range  (1-9,999,999,999).`,
      data: { eventIndex },
    });
  }
}

/** Raised when an event id does not follow the expected serialized format. */
export class INVALID_EVENT_ID_FORMAT extends EventIDError {
  /**
   * Creates the error.
   *
   * @param eventId Malformed event id.
   */
  constructor(eventId: string) {
    super({
      code: Code.INVALID_EVENT_ID_FORMAT,
      message: "Invalid Event ID format",
      details: `The provided Event ID ${eventId} does not match the expected format.`,
      data: { eventId },
    });
  }
}

/** Event-id error constructors indexed by stable code. */
export const ERROR_EVI = {
  [Code.EVENT_INDEX_OUT_OF_RANGE]: EVENT_INDEX_OUT_OF_RANGE,
  [Code.INVALID_EVENT_ID_FORMAT]: INVALID_EVENT_ID_FORMAT,
};
