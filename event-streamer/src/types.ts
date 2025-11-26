import type { EventFilter, BoundedArray } from "@colibri/core";

export type EventFilters = BoundedArray<EventFilter, 0, 5>;

// Re-export from core
export { EventFilter, EventType, EVF_ERRORS } from "@colibri/core";

export type {
  BoundedArray,
  EventFilterConstructorArgs,
  ContractId,
  TopicFilter,
  Segment,
  DoubleWildcard,
} from "@colibri/core";
