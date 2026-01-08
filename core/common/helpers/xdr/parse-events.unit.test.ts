import { assert, assertEquals, assertExists } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import type { xdr } from "stellar-sdk";
import { parseEvents } from "@/common/helpers/xdr/parse-events.ts";

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
