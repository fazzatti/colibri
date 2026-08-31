import type { VerificationLogEvent } from "@/core/types/result.ts";
import { LoggerFailedError } from "@/reporting/error.ts";
import type {
  RecordVerificationLogInput,
  VerificationLogger,
} from "@/reporting/types.ts";

const boundEvent = (
  event: VerificationLogEvent,
  maximum: number,
): VerificationLogEvent => {
  const encoded = new TextEncoder().encode(JSON.stringify(event));
  if (encoded.length <= maximum) return event;
  const boundedMessage = event.message.slice(
    0,
    Math.max(0, Math.floor(maximum / 4)),
  );
  return {
    ...event,
    message: `${boundedMessage}[event truncated by Colibri]`,
    data: undefined,
  };
};

/** In-memory logger that retains a bounded sequence for embedding or testing. */
export class BoundedVerificationLogCollector implements VerificationLogger {
  readonly #maximum: number;
  #events: VerificationLogEvent[] = [];

  /** Creates a collector that stores no more than `maximum` events. */
  constructor(maximum = 256) {
    this.#maximum = Math.max(1, maximum);
  }

  /** Stores one event while respecting the configured count. */
  log(event: VerificationLogEvent): void {
    if (this.#events.length < this.#maximum) this.#events.push(event);
  }

  /** Returns an immutable snapshot of collected events. */
  get events(): readonly VerificationLogEvent[] {
    return Object.freeze([...this.#events]);
  }
}

/** Records one bounded event and optionally forwards it to a live logger. */
export const recordVerificationLog = async (
  input: RecordVerificationLogInput,
): Promise<readonly VerificationLogEvent[]> => {
  const event = boundEvent(input.event, input.limits.maxLogBytes);
  if (input.logging?.logger) {
    try {
      await input.logging.logger.log(event);
    } catch (cause) {
      if (input.logging.strict) throw new LoggerFailedError(cause);
    }
  }
  if (input.logs.length >= input.limits.maxLogEvents) {
    const truncated: VerificationLogEvent = {
      timestamp: event.timestamp,
      stage: event.stage,
      level: "warning",
      code: "BLDV_LOG_TRUNCATED",
      message: "Additional structured verification events were omitted.",
    };
    return Object.freeze([
      ...input.logs.slice(0, input.limits.maxLogEvents - 1),
      truncated,
    ]);
  }
  return Object.freeze([...input.logs, event]);
};
