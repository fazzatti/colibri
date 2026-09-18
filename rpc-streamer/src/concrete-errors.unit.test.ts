import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  RPCStreamerError,
  RPCStreamerErrorCode,
  RPCStreamerErrors,
} from "@/errors.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("rpc-streamer concrete failures", () => {
  it("exports a distinct constructor for every stable code and preserves context", () => {
    const cause = new Error("underlying failure");
    const constructors = new Set<unknown>();
    for (const code of Object.values(RPCStreamerErrorCode)) {
      const Constructor = RPCStreamerErrors[code];
      const error = new Constructor("example", { option: 1 }, cause);
      assert(error instanceof RPCStreamerError);
      assertEquals(error.constructor, Constructor);
      assertNotEquals(error.constructor, RPCStreamerError);
      assertEquals(error.code, code);
      assertEquals(error.toJSON().code, code);
      assertEquals(error.cause, cause);

      constructors.add(error.constructor);
    }
    assertEquals(constructors.size, Object.keys(RPCStreamerErrors).length);
  });
});
