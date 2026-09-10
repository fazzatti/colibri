import { assertEquals } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { literal } from "@/generation/literal.ts";

describe("generated constant literals", () => {
  it("round-trips nested JSON values, empty collections and own prototype-named keys", () => {
    const value = {
      items: [1, "two", null, [], { enabled: true }],
      empty: {},
      omitted: undefined,
      ["__proto__"]: { safe: true },
    };
    const source = literal(value);
    // Evaluate only this fixed fixture to verify the emitted JavaScript's semantics.
    const decoded = new Function(`return (${source});`)();
    assertEquals(decoded, {
      items: [1, "two", null, [], { enabled: true }],
      empty: {},
      ["__proto__"]: { safe: true },
    });
    assertEquals(Object.getPrototypeOf(decoded), Object.prototype);
    assertEquals(Object.hasOwn(decoded, "__proto__"), true);
    assertEquals(Object.hasOwn(decoded, "omitted"), false);
  });
});
