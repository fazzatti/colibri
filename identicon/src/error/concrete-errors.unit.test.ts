import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { recordColibriTests } from "colibri-internal/tests/recorder/suite.ts";
import {
  IdenticonCode,
  IdenticonError,
  IdenticonErrors,
} from "@/error/index.ts";

const { describe, it } = recordColibriTests(import.meta.url);

describe("identicon concrete failures", () => {
  it("exports a distinct constructor for every stable code and preserves context", () => {
    const cause = new Error("underlying failure");
    const constructors = new Set<unknown>();
    for (const code of Object.values(IdenticonCode)) {
      const Constructor = IdenticonErrors[code];
      const error = new Constructor("example", { option: 1 }, cause);
      assert(error instanceof IdenticonError);
      assertEquals(error.constructor, Constructor);
      assertNotEquals(error.constructor, IdenticonError);
      assertEquals(error.code, code);
      assertEquals(error.toJSON().code, code);
      assertEquals(error.meta?.cause, cause);

      constructors.add(error.constructor);
    }
    assertEquals(constructors.size, Object.keys(IdenticonErrors).length);
  });
});
