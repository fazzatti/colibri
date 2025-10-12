import { assert, assertEquals, assertFalse, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import {
  isString,
  isNonBlank,
  dropNonPrintable,
  nonBlankString,
} from "./string.ts";

describe("String Helpers", () => {
  describe("isString", () => {
    it("should verify strings as true", () => {
      const strings = ["", "hello", "123", " ", "true", "false"];

      for (const str of strings) {
        assert(isString(str));
      }
    });

    it("should verify non-strings as false", () => {
      const nonStrings = [
        0,
        1,
        true,
        false,
        null,
        undefined,
        {},
        [],
        NaN,
        Infinity,
      ];

      for (const value of nonStrings) {
        assertFalse(isString(value));
      }
    });
  });

  describe("isNonBlank", () => {
    it("should verify non-blank strings as true", () => {
      const nonBlankStrings = ["hello", "123", "a", "test string", " a "];

      for (const str of nonBlankStrings) {
        assert(isNonBlank(str));
      }
    });

    it("should verify blank strings as false", () => {
      const blankStrings = ["", "   ", "\t", "\n", "  \t\n  "];

      for (const str of blankStrings) {
        assertFalse(isNonBlank(str));
      }
    });

    it("should verify non-strings as false", () => {
      const nonStrings = [0, 1, true, false, null, undefined, {}, []];

      for (const value of nonStrings) {
        assertFalse(isNonBlank(value));
      }
    });
  });

  describe("dropNonPrintable", () => {
    it("should remove non-printable characters", () => {
      const input = "hello\x00world\x01test";
      const result = dropNonPrintable(input);
      assertEquals(result, "helloworldtest");
    });

    it("should preserve printable characters", () => {
      const input = "Hello World 123!@# $%^&*()";
      const result = dropNonPrintable(input);
      assertEquals(result, input);
    });

    it("should throw for non-string input", () => {
      assertThrows(() => dropNonPrintable(123 as unknown as string));
    });
  });

  describe("nonBlankString", () => {
    it("should not throw for non-blank strings", () => {
      const nonBlankStrings = ["hello", "123", " a ", "test"];

      for (const str of nonBlankStrings) {
        nonBlankString(str);
      }
    });

    it("should throw for blank strings", () => {
      const blankStrings = ["", "   ", "\t", "\n"];

      for (const str of blankStrings) {
        assertThrows(() => nonBlankString(str));
      }
    });

    it("should throw for non-strings", () => {
      const nonStrings = [0, 1, true, null, undefined, {}, []];

      for (const value of nonStrings) {
        assertThrows(() => nonBlankString(value));
      }
    });

    it("should include subject in error message", () => {
      assertThrows(() => nonBlankString("", "myVariable"), Error, "myVariable");
    });
  });
});
