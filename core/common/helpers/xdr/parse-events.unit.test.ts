import { assert, assertEquals, assertExists } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import type { xdr } from "stellar-sdk";
import { parseEvents } from "@/common/helpers/xdr/parse-events.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("parseEvents", () => {
  it("should parse events successfully", () => {
    const events: xdr.ContractEvent[] = [];
    const result = parseEvents(events);
    assertExists(result);
    assert(Array.isArray(result));
  });

  it("should return null for undefined events", () => {
    const result = parseEvents(undefined);
    assertEquals(result, null);
  });
});
