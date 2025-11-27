import { xdr } from "stellar-sdk";
import type { Api } from "stellar-sdk/rpc";
import type { EventType } from "@/event/types.ts";
import type {
  TopicFilter,
  EventFilterConstructorArgs,
} from "@/event/event-filter/types.ts";
import type { BoundedArray } from "@/common/helpers/bounded-array.ts";
import type { ContractId } from "@/strkeys/types.ts";
import { assert } from "@/common/assert/assert.ts";
import * as E from "@/event/event-filter/error.ts";
export class EventFilter {
  private _type?: EventType;
  private _contractIds?: BoundedArray<ContractId, 0, 5>;
  private _topics?: BoundedArray<TopicFilter, 0, 5>;

  constructor(params: EventFilterConstructorArgs) {
    this._type = params.type;
    this._contractIds = params.contractIds;
    this._topics = params.topics;
  }

  private encodeTopics(topicFilter: TopicFilter): BoundedArray<string, 0, 4> {
    return topicFilter.map((segment) => {
      if (segment === "*") {
        return "*";
      } else if (segment === "**") {
        return "**";
      } else {
        return segment.toXDR("base64");
      }
    }) as BoundedArray<string, 0, 4>;
  }

  public toRawEventFilter(): Api.EventFilter {
    return {
      type: this._type,
      contractIds: this._contractIds,
      topics:
        this._topics === undefined
          ? undefined
          : [
              ...this._topics.map((topicFilter) =>
                this.encodeTopics(topicFilter)
              ),
            ],
    };
  }

  public matchesType(type: EventType): boolean {
    if (this._type !== undefined && this._type !== type) {
      return false;
    }
    return true;
  }

  public matchesContractId(contractId: ContractId): boolean {
    if (
      this._contractIds !== undefined &&
      this._contractIds.length > 0 &&
      !(this._contractIds as ContractId[]).includes(contractId)
    ) {
      return false;
    }
    return true;
  }

  public matchesTopics(topics: xdr.ScVal[]): boolean {
    if (!this._topics || this._topics.length === 0) return true; // No topic filters, match all

    for (const topicFilter of this._topics) {
      if (eventTopicsMatchFilterTopic(topicFilter, topics)) return true;
    }

    return false;
  }
}
const eventTopicsMatchFilterTopic = (
  topicFilter: TopicFilter,
  eventTopics: xdr.ScVal[]
): boolean => {
  assert(eventTopics.length > 0, new E.EVENT_HAS_NO_TOPICS());

  for (let i = 0; i < eventTopics.length; i++) {
    const eventSegment = eventTopics[i];

    if (topicFilter.length < i + 1) return false; // No more filter segments to match

    const filterSegment = topicFilter[i];
    if (filterSegment === "**") return true; // Matches this segment and all remaining
    if (filterSegment === "*") continue; // Wildcard matches any single segment

    try {
      // Checks for the exact segment value
      if (
        filterSegment instanceof xdr.ScVal &&
        filterSegment.toXDR("base64") === eventSegment.toXDR("base64")
      )
        continue; // Matched this segment, continue to next
    } catch (e) {
      throw new E.FAILED_TO_CHECK_FILTER_SEGMENT(
        filterSegment,
        eventSegment,
        e as Error
      );
    }
    return false; // No match for this segment
  }

  // All event segments matched, check if filter has remaining non-wildcard segments
  return topicFilter.length <= eventTopics.length;
};
