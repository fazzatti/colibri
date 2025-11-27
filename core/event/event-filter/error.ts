import { ColibriError } from "@/error/index.ts";
import type { Diagnostic } from "@/error/types.ts";
import type { Segment } from "@/event/event-filter/types.ts";
import type { xdr } from "stellar-sdk";

export type Meta = {
  cause: Error | null;
  data: unknown;
};

export type EventFilterErrorShape<Code extends string> = {
  code: Code;
  message: string;
  details: string;
  diagnostic?: Diagnostic;

  cause?: Error;
  data: unknown;
};

export abstract class EventFilterError extends ColibriError<Code, Meta> {
  override readonly source = "@colibri/core/events/event-filter";
  override readonly meta: Meta;

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

export enum Code {
  EVENT_HAS_NO_TOPICS = "EVF_001",
  FAILED_TO_CHECK_FILTER_SEGMENT = "EVF_002",
}

export class EVENT_HAS_NO_TOPICS extends EventFilterError {
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

export class FAILED_TO_CHECK_FILTER_SEGMENT extends EventFilterError {
  constructor(filterSegment: Segment, eventSegment: xdr.ScVal, cause: Error) {
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

export const ERROR_EVF = {
  [Code.EVENT_HAS_NO_TOPICS]: EVENT_HAS_NO_TOPICS,
  [Code.FAILED_TO_CHECK_FILTER_SEGMENT]: FAILED_TO_CHECK_FILTER_SEGMENT,
};
