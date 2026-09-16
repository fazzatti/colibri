import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  Sep10Code,
  Sep10Error,
  Sep45Code,
  Sep45Error,
  WebAuthCode,
  WebAuthError,
  WebAuthErrors,
} from "@/error.ts";

describe("webauth concrete failures", () => {
  it("exports a distinct constructor for every stable code and preserves context", () => {
    const cause = new Error("underlying failure");
    const constructors = new Set<unknown>();
    for (
      const code of [
        ...Object.values(WebAuthCode),
        ...Object.values(Sep10Code),
        ...Object.values(Sep45Code),
      ]
    ) {
      const Constructor = WebAuthErrors[code];
      const error = new Constructor({
        message: "example",
        cause,
        endpoint: "https://example.test",
        data: { option: 1 },
      });
      assert(error instanceof WebAuthError);
      assertEquals(error.constructor, Constructor);
      assertNotEquals(error.constructor, WebAuthError);
      assertEquals(error.code, code);
      assertEquals(error.toJSON().code, code);
      assertEquals(error.meta?.cause, cause);

      if (code.startsWith("SEP10")) {
        assert(error instanceof Sep10Error);
        assertEquals(error.protocol, "sep10");
      }
      if (code.startsWith("SEP45")) {
        assert(error instanceof Sep45Error);
        assertEquals(error.protocol, "sep45");
      }

      constructors.add(error.constructor);
    }
    assertEquals(constructors.size, Object.keys(WebAuthErrors).length);
  });
});
