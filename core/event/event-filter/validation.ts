import type { Segment } from "@/event/event-filter/types.ts";
import * as ERROR from "@/event/event-filter/error.ts";
/** @internal Keeps RPC query limits separate from the number of event topics. */
export function validateRpcTopicFilter(
  filter: readonly (Segment | "**")[],
): void {
  const wildcard = filter.indexOf("**");
  const constrained = wildcard === -1 ? filter.length : wildcard;
  if (
    !filter.length || constrained > 4 ||
    (wildcard !== -1 && wildcard !== filter.length - 1)
  ) {
    throw new ERROR.INVALID_TOPIC_FILTER(filter.length);
  }
}
