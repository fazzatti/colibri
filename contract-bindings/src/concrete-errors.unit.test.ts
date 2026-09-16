import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { BindingError, BindingErrors, Code } from "@/error.ts";

describe("contract-bindings concrete failures", () => {
  it("exports a distinct constructor for every stable code and preserves context", () => {
    const cause = new Error("underlying failure");
    const constructors = new Set<unknown>();
    for (const code of Object.values(Code)) {
      const Constructor = BindingErrors[code];
      const error = new Constructor("example", cause);
      assert(error instanceof BindingError);
      assertEquals(error.constructor, Constructor);
      assertNotEquals(error.constructor, BindingError);
      assertEquals(error.code, code);
      assertEquals(error.toJSON().code, code);
      assertEquals(error.meta?.cause, cause);

      constructors.add(error.constructor);
    }
    assertEquals(constructors.size, Object.keys(BindingErrors).length);
  });
});
