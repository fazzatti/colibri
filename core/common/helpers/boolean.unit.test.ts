import { assert, assertFalse, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { isBooleanStrict, isTruthy } from "@/common/helpers/boolean.ts";

describe("Boolean Helpers", () => {
  describe("isBooleanStrict", () => {
    it("should verify true as boolean", () => {
      assert(isBooleanStrict(true));
    });

    it("should verify false as boolean", () => {
      assert(isBooleanStrict(false));
    });

    it("should verify non-boolean values as false", () => {
      const nonBooleans = [
        0,
        1,
        "",
        "true",
        "false",
        null,
        undefined,
        {},
        [],
        NaN,
        Infinity,
      ];

      for (const value of nonBooleans) {
        assertFalse(isBooleanStrict(value));
      }
    });
  });

  describe("isTruthy", () => {
    it("should not throw for truthy values", () => {
      const truthyValues = [true, 1, "hello", {}, [], -1, Infinity];

      for (const value of truthyValues) {
        isTruthy(value);
      }
    });

    it("should throw for falsy values", () => {
      const falsyValues = [false, 0, "", null, undefined, NaN];

      for (const value of falsyValues) {
        assertThrows(() => isTruthy(value));
      }
    });

    it("should include subject in error message", () => {
      assertThrows(() => isTruthy(false, "myVariable"), Error, "myVariable");
    });
  });
});
