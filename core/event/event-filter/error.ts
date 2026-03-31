import { ColibriError } from "@/error/index.ts";
import type { ScValLike } from "@/common/types/index.ts";
import type { Diagnostic } from "@/error/types.ts";
import type { Segment } from "@/event/event-filter/types.ts";

/** Additional metadata attached to event-filter errors. */
export type Meta = {
  cause: Error | null;
  data: unknown;
};

/** Constructor shape accepted by {@link EventFilterError}. */
export type EventFilterErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;

  cause?: Error;
  data: unknown;
};

/** Base error type for event-filter failures. */
export abstract class EventFilterError extends ColibriError<Code, Meta> {
  /** Stable source identifier for event-filter errors. */
  override readonly source = "@colibri/core/events/event-filter";
  /** Structured metadata attached to the error. */
  override readonly meta: Meta;

  /**
   * Creates a new event-filter error.
   *
   * @param args Error construction payload.
   */
  constructor(args: EventFilterErrorShape<Code>) {
    const meta = {
      cause: args.cause || null,
      data: args.data,
    };

    super({
      domain: "events" as const,
      source: "@colibri/core/events/event-filter",
      code: args.code,
      message: args.message,
      details: args.details,
      diagnostic: args.diagnostic || undefined,
      meta,
    });

    this.meta = meta;
  }
}

/** Stable error codes emitted by event-filter helpers. */
export enum Code {
  EVENT_HAS_NO_TOPICS = "EVF_001",
  FAILED_TO_CHECK_FILTER_SEGMENT = "EVF_002",
}

/** Raised when topic matching is requested for an event with no topics. */
export class EVENT_HAS_NO_TOPICS extends EventFilterError {
  /** Creates the error. */
  constructor() {
    super({
      code: Code.EVENT_HAS_NO_TOPICS,
      message: "Event has no topics",
      details:
        "The event does not contain any topics, but the filter requires topics to match.",
      data: {},
    });
  }
}

/** Raised when topic segment comparison fails unexpectedly. */
export class FAILED_TO_CHECK_FILTER_SEGMENT extends EventFilterError {
  /**
   * Creates the error.
   *
   * @param filterSegment Filter segment being compared.
   * @param eventSegment Event segment being compared.
   * @param cause Underlying comparison failure.
   */
  constructor(filterSegment: Segment, eventSegment: ScValLike, cause: Error) {
    super({
      code: Code.FAILED_TO_CHECK_FILTER_SEGMENT,
      message: "Failed to check filter segment against event segment",
      details: `An error occurred while checking the filter segment ${filterSegment.toString()} against the event segment ${eventSegment.toString()}.`,
      cause,
      data: {
        filterSegment: filterSegment,
        eventSegment: eventSegment,
      },
    });
  }
}

/** Event-filter error constructors indexed by stable code. */
export const ERROR_EVF = {
  [Code.EVENT_HAS_NO_TOPICS]: EVENT_HAS_NO_TOPICS,
  [Code.FAILED_TO_CHECK_FILTER_SEGMENT]: FAILED_TO_CHECK_FILTER_SEGMENT,
};
