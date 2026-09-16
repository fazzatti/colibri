import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { ColibriReactError, ReactCode, ReactErrors } from "@/errors/index.ts";

describe("react concrete failures", () => {
  it("exports a distinct constructor for every stable code and preserves context", () => {
    const constructors = new Set<unknown>();
    for (const code of Object.values(ReactCode)) {
      const Constructor = ReactErrors[code];
      const error = new Constructor("example");
      assert(error instanceof ColibriReactError);
      assertEquals(error.constructor, Constructor);
      assertNotEquals(error.constructor, ColibriReactError);
      assertEquals(error.code, code);
      assertEquals(error.toJSON().code, code);

      constructors.add(error.constructor);
    }
    assertEquals(constructors.size, Object.keys(ReactErrors).length);
  });
});
