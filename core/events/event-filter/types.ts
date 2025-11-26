import type { xdr } from "stellar-sdk";
import type { BoundedArray } from "@/common/helpers/bounded-array.ts";
import type { EventType } from "@/events/types.ts";
import type { ContractId } from "@/strkeys/types.ts";

/**
 * List of filters for the returned events.
 * Events matching any of the filters are included.
 * To match a filter, an event must match both a contractId and a topic.
 * Maximum 5 filters are allowed per request.
 */
// export type EventFilters = BoundedArray<EventFilter, 0, 5>;

export type EventFilterConstructorArgs = {
  /**
   * Filter events by type. If omitted, all event types are included.
   */
  type?: EventType;

  /**
   * List of contract IDs to query for events.
   * If omitted, return events for all contracts.
   * Maximum 5 contract IDs are allowed per request.
   */
  contractIds?: BoundedArray<ContractId, 0, 5>;

  /**
   * List of topic filters.
   * If omitted, query for all events.
   * If multiple filters are specified, events will be included if they match any of the filters.
   * Maximum 5 filters are allowed per request.
   */
  topics?: BoundedArray<TopicFilter, 0, 5>;
};

/**
 * A single topic filter consisting of segment matchers.
 * Corresponds to the event topics (1-4 items).
 *
 * A segment matcher can be:
 * - A specific value (xdr.ScVal) to match exactly.
 * - The wildcard "*" to match any single segment.
 * - The double wildcard "**" to match zero or more segments.
 *   This can only appear at the end of the topic filter.
 */
export type TopicFilter =
  // | []
  | [Segment]
  | [DoubleWildcard]
  | [Segment, Segment]
  | [Segment, DoubleWildcard]
  | [Segment, Segment, Segment]
  | [Segment, Segment, DoubleWildcard]
  | [Segment, Segment, Segment, Segment]
  | [Segment, Segment, Segment, DoubleWildcard];

export type Segment = "*" | xdr.ScVal;
export type DoubleWildcard = "**";
