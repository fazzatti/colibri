import {
  assertEquals,
  assertExists,
  assertInstanceOf,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { xdr } from "stellar-sdk";
import {
  EventFilterError,
  EVENT_HAS_NO_TOPICS,
  FAILED_TO_CHECK_FILTER_SEGMENT,
  Code,
  ERROR_EVF,
} from "@/events/event-filter/error.ts";
import { EventFilter } from "@/events/event-filter/index.ts";
import type { TopicFilter } from "@/events/event-filter/types.ts";
import type { ContractId } from "@/strkeys/types.ts";
import { EventType } from "@/events/types.ts";

describe("EventFilter Errors", () => {
  describe("Code enum", () => {
    it("should have correct error codes", () => {
      assertEquals(Code.EVENT_HAS_NO_TOPICS, "EVF_001");
      assertEquals(Code.FAILED_TO_CHECK_FILTER_SEGMENT, "EVF_002");
    });
  });

  describe("EVENT_HAS_NO_TOPICS", () => {
    it("should create error with correct properties", () => {
      const error = new EVENT_HAS_NO_TOPICS();

      assertExists(error);
      assertInstanceOf(error, EventFilterError);
      assertInstanceOf(error, Error);
      assertEquals(error.code, Code.EVENT_HAS_NO_TOPICS);
      assertEquals(error.message, "Event has no topics");
      assertEquals(
        error.details,
        "The event does not contain any topics, but the filter requires topics to match."
      );
      assertEquals(error.source, "@colibri/core/events/event-filter");
    });

    it("should have correct meta properties", () => {
      const error = new EVENT_HAS_NO_TOPICS();

      assertExists(error.meta);
      assertEquals(error.meta.cause, null);
      assertEquals(error.meta.data, {});
    });

    it("should have domain set to events", () => {
      const error = new EVENT_HAS_NO_TOPICS();

      assertEquals(error.domain, "events");
    });

    it("should have undefined diagnostic by default", () => {
      const error = new EVENT_HAS_NO_TOPICS();

      assertEquals(error.diagnostic, undefined);
    });
  });

  describe("FAILED_TO_CHECK_FILTER_SEGMENT", () => {
    it("should create error with wildcard filter segment", () => {
      const filterSegment = "*" as const;
      const eventSegment = xdr.ScVal.scvBool(true);
      const cause = new Error("Test cause error");

      const error = new FAILED_TO_CHECK_FILTER_SEGMENT(
        filterSegment,
        eventSegment,
        cause
      );

      assertExists(error);
      assertInstanceOf(error, EventFilterError);
      assertInstanceOf(error, Error);
      assertEquals(error.code, Code.FAILED_TO_CHECK_FILTER_SEGMENT);
      assertEquals(
        error.message,
        "Failed to check filter segment against event segment"
      );
      assertEquals(error.source, "@colibri/core/events/event-filter");
      assertEquals(error.domain, "events");
    });

    it("should create error with ScVal filter segment", () => {
      const filterSegment = xdr.ScVal.scvSymbol("test");
      const eventSegment = xdr.ScVal.scvBool(false);
      const cause = new Error("XDR encoding failed");

      const error = new FAILED_TO_CHECK_FILTER_SEGMENT(
        filterSegment,
        eventSegment,
        cause
      );

      assertExists(error);
      assertEquals(error.code, Code.FAILED_TO_CHECK_FILTER_SEGMENT);
    });

    it("should have correct meta with cause and data", () => {
      const filterSegment = xdr.ScVal.scvSymbol("test");
      const eventSegment = xdr.ScVal.scvBool(false);
      const cause = new Error("XDR encoding failed");

      const error = new FAILED_TO_CHECK_FILTER_SEGMENT(
        filterSegment,
        eventSegment,
        cause
      );

      assertExists(error.meta);
      assertEquals(error.meta.cause, cause);
      assertExists(error.meta.data);

      const data = error.meta.data as {
        filterSegment: typeof filterSegment;
        eventSegment: typeof eventSegment;
      };
      assertEquals(data.filterSegment, filterSegment);
      assertEquals(data.eventSegment, eventSegment);
    });

    it("should include segment info in details for wildcard", () => {
      const filterSegment = "*" as const;
      const eventSegment = xdr.ScVal.scvI32(42);
      const cause = new Error("Comparison failed");

      const error = new FAILED_TO_CHECK_FILTER_SEGMENT(
        filterSegment,
        eventSegment,
        cause
      );

      assertExists(error.details);
      assertEquals(error.details.includes("*"), true);
    });

    it("should include segment info in details for ScVal", () => {
      const filterSegment = xdr.ScVal.scvString("myEvent");
      const eventSegment = xdr.ScVal.scvString("otherEvent");
      const cause = new Error("Mismatch");

      const error = new FAILED_TO_CHECK_FILTER_SEGMENT(
        filterSegment,
        eventSegment,
        cause
      );

      assertExists(error.details);
      // Details should contain the error message about checking segments
      assertEquals(error.details.includes("checking the filter segment"), true);
    });

    it("should have undefined diagnostic by default", () => {
      const filterSegment = "*" as const;
      const eventSegment = xdr.ScVal.scvI32(42);
      const cause = new Error("Test");

      const error = new FAILED_TO_CHECK_FILTER_SEGMENT(
        filterSegment,
        eventSegment,
        cause
      );

      assertEquals(error.diagnostic, undefined);
    });
  });

  describe("ERROR_EVF registry", () => {
    it("should contain all error classes", () => {
      assertExists(ERROR_EVF);
      assertEquals(ERROR_EVF[Code.EVENT_HAS_NO_TOPICS], EVENT_HAS_NO_TOPICS);
      assertEquals(
        ERROR_EVF[Code.FAILED_TO_CHECK_FILTER_SEGMENT],
        FAILED_TO_CHECK_FILTER_SEGMENT
      );
    });

    it("should allow instantiation of EVENT_HAS_NO_TOPICS from registry", () => {
      const ErrorClass = ERROR_EVF[Code.EVENT_HAS_NO_TOPICS];
      const error = new ErrorClass();

      assertInstanceOf(error, EVENT_HAS_NO_TOPICS);
      assertInstanceOf(error, EventFilterError);
    });

    it("should have exactly 2 error codes in registry", () => {
      const keys = Object.keys(ERROR_EVF);
      assertEquals(keys.length, 2);
    });
  });

  describe("EventFilterError base class behavior", () => {
    it("should set cause to null when not provided", () => {
      const error = new EVENT_HAS_NO_TOPICS();

      assertEquals(error.meta.cause, null);
    });

    it("should preserve cause when provided", () => {
      const cause = new Error("Original error");
      const filterSegment = "*" as const;
      const eventSegment = xdr.ScVal.scvI32(1);

      const error = new FAILED_TO_CHECK_FILTER_SEGMENT(
        filterSegment,
        eventSegment,
        cause
      );

      assertEquals(error.meta.cause, cause);
      assertEquals(error.meta.cause?.message, "Original error");
    });

    it("should preserve data in meta", () => {
      const filterSegment = xdr.ScVal.scvSymbol("transfer");
      const eventSegment = xdr.ScVal.scvSymbol("mint");
      const cause = new Error("Test");

      const error = new FAILED_TO_CHECK_FILTER_SEGMENT(
        filterSegment,
        eventSegment,
        cause
      );

      const data = error.meta.data as {
        filterSegment: xdr.ScVal;
        eventSegment: xdr.ScVal;
      };

      assertEquals(
        data.filterSegment.toXDR("base64"),
        filterSegment.toXDR("base64")
      );
      assertEquals(
        data.eventSegment.toXDR("base64"),
        eventSegment.toXDR("base64")
      );
    });
  });
});

describe("EventFilter", () => {
  describe("constructor", () => {
    it("should create filter with no params", () => {
      const filter = new EventFilter({});
      assertExists(filter);
    });

    it("should create filter with type", () => {
      const filter = new EventFilter({ type: EventType.Contract });
      assertExists(filter);
    });

    it("should create filter with contractIds", () => {
      const contractIds: [ContractId] = [
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId,
      ];
      const filter = new EventFilter({ contractIds });
      assertExists(filter);
    });

    it("should create filter with topics", () => {
      const topics: [TopicFilter] = [[xdr.ScVal.scvSymbol("transfer")]];
      const filter = new EventFilter({ topics });
      assertExists(filter);
    });
  });

  describe("toRawEventFilter", () => {
    it("should return empty filter when no params", () => {
      const filter = new EventFilter({});
      const raw = filter.toRawEventFilter();

      assertEquals(raw.type, undefined);
      assertEquals(raw.contractIds, undefined);
      assertEquals(raw.topics, undefined);
    });

    it("should encode type correctly", () => {
      const filter = new EventFilter({ type: EventType.Contract });
      const raw = filter.toRawEventFilter();

      assertEquals(raw.type, EventType.Contract);
    });

    it("should encode contractIds correctly", () => {
      const contractIds: [ContractId] = [
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId,
      ];
      const filter = new EventFilter({ contractIds });
      const raw = filter.toRawEventFilter();

      assertEquals(raw.contractIds, contractIds);
    });

    it("should encode single wildcard * in topics", () => {
      const topics: [TopicFilter] = [["*"]];
      const filter = new EventFilter({ topics });
      const raw = filter.toRawEventFilter();

      assertExists(raw.topics);
      assertEquals(raw.topics[0][0], "*");
    });

    it("should encode double wildcard ** in topics", () => {
      const topics: [TopicFilter] = [["**"]];
      const filter = new EventFilter({ topics });
      const raw = filter.toRawEventFilter();

      assertExists(raw.topics);
      assertEquals(raw.topics[0][0], "**");
    });

    it("should encode ScVal as base64 in topics", () => {
      const scVal = xdr.ScVal.scvSymbol("transfer");
      const topics: [TopicFilter] = [[scVal]];
      const filter = new EventFilter({ topics });
      const raw = filter.toRawEventFilter();

      assertExists(raw.topics);
      assertEquals(raw.topics[0][0], scVal.toXDR("base64"));
    });

    it("should encode mixed topic filters", () => {
      const scVal = xdr.ScVal.scvSymbol("transfer");
      const topics: [TopicFilter] = [[scVal, "*", "**"]];
      const filter = new EventFilter({ topics });
      const raw = filter.toRawEventFilter();

      assertExists(raw.topics);
      assertEquals(raw.topics[0][0], scVal.toXDR("base64"));
      assertEquals(raw.topics[0][1], "*");
      assertEquals(raw.topics[0][2], "**");
    });
  });

  describe("matchesType", () => {
    it("should match any type when no type filter specified", () => {
      const filter = new EventFilter({});

      assertEquals(filter.matchesType(EventType.Contract), true);
      assertEquals(filter.matchesType(EventType.System), true);
    });

    it("should match when type matches filter", () => {
      const filter = new EventFilter({ type: EventType.Contract });

      assertEquals(filter.matchesType(EventType.Contract), true);
    });

    it("should not match when type differs from filter", () => {
      const filter = new EventFilter({ type: EventType.Contract });

      assertEquals(filter.matchesType(EventType.System), false);
    });
  });

  describe("matchesContractId", () => {
    const testContractId =
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC" as ContractId;
    const otherContractId =
      "CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA" as ContractId;

    it("should match any contractId when no filter specified", () => {
      const filter = new EventFilter({});

      assertEquals(filter.matchesContractId(testContractId), true);
      assertEquals(filter.matchesContractId(otherContractId), true);
    });

    it("should match any contractId when empty array specified", () => {
      const filter = new EventFilter({ contractIds: [] });

      assertEquals(filter.matchesContractId(testContractId), true);
    });

    it("should match when contractId is in filter list", () => {
      const filter = new EventFilter({ contractIds: [testContractId] });

      assertEquals(filter.matchesContractId(testContractId), true);
    });

    it("should not match when contractId is not in filter list", () => {
      const filter = new EventFilter({ contractIds: [testContractId] });

      assertEquals(filter.matchesContractId(otherContractId), false);
    });

    it("should match when contractId is one of multiple in filter", () => {
      const filter = new EventFilter({
        contractIds: [testContractId, otherContractId],
      });

      assertEquals(filter.matchesContractId(testContractId), true);
      assertEquals(filter.matchesContractId(otherContractId), true);
    });
  });

  describe("matchesTopics", () => {
    it("should match all topics when no filter specified", () => {
      const filter = new EventFilter({});
      const topics = [xdr.ScVal.scvSymbol("transfer")];

      assertEquals(filter.matchesTopics(topics), true);
    });

    it("should match all topics when empty topics array specified", () => {
      const filter = new EventFilter({ topics: [] });
      const topics = [xdr.ScVal.scvSymbol("transfer")];

      assertEquals(filter.matchesTopics(topics), true);
    });

    it("should throw EVENT_HAS_NO_TOPICS when event has empty topics", () => {
      const filter = new EventFilter({
        topics: [[xdr.ScVal.scvSymbol("transfer")]],
      });

      assertThrows(() => filter.matchesTopics([]), EVENT_HAS_NO_TOPICS);
    });

    it("should match with single wildcard *", () => {
      const filter = new EventFilter({ topics: [["*"]] });
      const topics = [xdr.ScVal.scvSymbol("anything")];

      assertEquals(filter.matchesTopics(topics), true);
    });

    it("should match with double wildcard **", () => {
      const filter = new EventFilter({ topics: [["**"]] });
      const topics = [
        xdr.ScVal.scvSymbol("a"),
        xdr.ScVal.scvSymbol("b"),
        xdr.ScVal.scvSymbol("c"),
      ];

      assertEquals(filter.matchesTopics(topics), true);
    });

    it("should match exact ScVal value", () => {
      const transferSymbol = xdr.ScVal.scvSymbol("transfer");
      const filter = new EventFilter({ topics: [[transferSymbol]] });
      const topics = [xdr.ScVal.scvSymbol("transfer")];

      assertEquals(filter.matchesTopics(topics), true);
    });

    it("should not match different ScVal value", () => {
      const transferSymbol = xdr.ScVal.scvSymbol("transfer");
      const filter = new EventFilter({ topics: [[transferSymbol]] });
      const topics = [xdr.ScVal.scvSymbol("mint")];

      assertEquals(filter.matchesTopics(topics), false);
    });

    it("should match with wildcard followed by exact value", () => {
      const toSymbol = xdr.ScVal.scvSymbol("to");
      const filter = new EventFilter({ topics: [["*", toSymbol]] });
      const topics = [
        xdr.ScVal.scvSymbol("transfer"),
        xdr.ScVal.scvSymbol("to"),
      ];

      assertEquals(filter.matchesTopics(topics), true);
    });

    it("should match with exact value followed by double wildcard", () => {
      const transferSymbol = xdr.ScVal.scvSymbol("transfer");
      const filter = new EventFilter({ topics: [[transferSymbol, "**"]] });
      const topics = [
        xdr.ScVal.scvSymbol("transfer"),
        xdr.ScVal.scvSymbol("from"),
        xdr.ScVal.scvSymbol("to"),
      ];

      assertEquals(filter.matchesTopics(topics), true);
    });

    it("should not match when filter has more segments than event topics", () => {
      const seg1 = xdr.ScVal.scvSymbol("a");
      const seg2 = xdr.ScVal.scvSymbol("b");
      const seg3 = xdr.ScVal.scvSymbol("c");
      const filter = new EventFilter({ topics: [[seg1, seg2, seg3]] });
      const topics = [xdr.ScVal.scvSymbol("a"), xdr.ScVal.scvSymbol("b")];

      assertEquals(filter.matchesTopics(topics), false);
    });

    it("should not match when event has more topics than filter segments", () => {
      const seg1 = xdr.ScVal.scvSymbol("a");
      const filter = new EventFilter({ topics: [[seg1]] });
      const topics = [
        xdr.ScVal.scvSymbol("a"),
        xdr.ScVal.scvSymbol("b"),
        xdr.ScVal.scvSymbol("c"),
      ];

      assertEquals(filter.matchesTopics(topics), false);
    });

    it("should match if any of multiple topic filters match (OR logic)", () => {
      const transferSymbol = xdr.ScVal.scvSymbol("transfer");
      const mintSymbol = xdr.ScVal.scvSymbol("mint");
      const filter = new EventFilter({
        topics: [[transferSymbol], [mintSymbol]],
      });

      assertEquals(
        filter.matchesTopics([xdr.ScVal.scvSymbol("transfer")]),
        true
      );
      assertEquals(filter.matchesTopics([xdr.ScVal.scvSymbol("mint")]), true);
      assertEquals(filter.matchesTopics([xdr.ScVal.scvSymbol("burn")]), false);
    });

    it("should match complex multi-segment filter", () => {
      const transfer = xdr.ScVal.scvSymbol("transfer");
      const from = xdr.ScVal.scvSymbol("from");
      const filter = new EventFilter({ topics: [[transfer, "*", from, "**"]] });

      const topics = [
        xdr.ScVal.scvSymbol("transfer"),
        xdr.ScVal.scvSymbol("anything"),
        xdr.ScVal.scvSymbol("from"),
        xdr.ScVal.scvSymbol("extra"),
      ];

      assertEquals(filter.matchesTopics(topics), true);
    });

    it("should handle multiple wildcards correctly", () => {
      const filter = new EventFilter({ topics: [["*", "*", "*"]] });
      const topics = [
        xdr.ScVal.scvSymbol("a"),
        xdr.ScVal.scvSymbol("b"),
        xdr.ScVal.scvSymbol("c"),
      ];

      assertEquals(filter.matchesTopics(topics), true);
    });

    it("should not match when fewer event topics than single wildcards", () => {
      const filter = new EventFilter({ topics: [["*", "*", "*"]] });
      const topics = [xdr.ScVal.scvSymbol("a"), xdr.ScVal.scvSymbol("b")];

      assertEquals(filter.matchesTopics(topics), false);
    });

    it("should throw FAILED_TO_CHECK_FILTER_SEGMENT when XDR encoding fails", () => {
      // Create a corrupted ScVal-like object that will throw on toXDR
      const corruptedScVal = Object.create(xdr.ScVal.prototype);
      corruptedScVal.toXDR = () => {
        throw new Error("XDR encoding failed");
      };

      const filter = new EventFilter({ topics: [[corruptedScVal]] });
      const topics = [xdr.ScVal.scvSymbol("test")];

      assertThrows(
        () => filter.matchesTopics(topics),
        FAILED_TO_CHECK_FILTER_SEGMENT
      );
    });
  });
});
