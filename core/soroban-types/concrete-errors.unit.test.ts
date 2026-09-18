import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  SorobanErrors,
  SorobanValueError,
  SorobanValueErrorCode,
} from "@/soroban-types/error.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("core concrete failures", () => {
  it("exports a distinct constructor for every stable code and preserves context", () => {
    const cause = new Error("underlying failure");
    const constructors = new Set<unknown>();
    for (const code of Object.values(SorobanValueErrorCode)) {
      const Constructor = SorobanErrors[code];
      const error = new Constructor("u32", "example", cause);
      assert(error instanceof SorobanValueError);
      assertEquals(error.constructor, Constructor);
      assertNotEquals(error.constructor, SorobanValueError);
      assertEquals(error.code, code);
      assertEquals(error.toJSON().code, code);
      assertEquals(error.meta?.cause, cause);

      constructors.add(error.constructor);
    }
    assertEquals(constructors.size, Object.keys(SorobanErrors).length);
  });
});
