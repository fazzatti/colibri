import { assertEquals, assertThrows } from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { fromDecimals, toDecimals } from "@/common/helpers/format-units.ts";
import { ColibriError } from "@/error/index.ts";
import * as E from "@/common/helpers/format-units.error.ts";

describe("format-units", () => {
  describe("fromDecimals", () => {
    it("parses .5 and 5.", () => {
      assertEquals(fromDecimals(".5", 6), 500000n);
      assertEquals(fromDecimals("5.", 6), 5000000n);
    });

    it("parses numbers and leading + sign", () => {
      assertEquals(fromDecimals(1.25, 2), 125n);
      assertEquals(fromDecimals("+1.25", 2), 125n);
    });

    it("handles signs, leading zeros, and bigint passthrough", () => {
      assertEquals(fromDecimals("-0001.2300", 6), -1230000n);
      assertEquals(fromDecimals(123n, 6), 123n);
    });

    it("supports truncation of excess fractional digits", () => {
      assertEquals(
        fromDecimals("1.23456789", 6, { excessFraction: "truncate" }),
        1234567n
      );
    });

    it("parses scientific notation", () => {
      assertEquals(fromDecimals("1e-6", 6), 1n);
      assertEquals(fromDecimals("1.23e2", 6), 123000000n);
    });

    it("parses scientific notation that produces a fractional split", () => {
      // 12.34e-1 => 1.234
      assertEquals(fromDecimals("12.34e-1", 6), 1234000n);
    });

    it("throws typed ColibriError with code", () => {
      const err = assertThrows(() => fromDecimals("1.234", 2));
      if (!(err instanceof ColibriError)) throw err;
      assertEquals(err.domain, "helpers");
      assertEquals(err.code, E.Code.TOO_MANY_FRACTION_DIGITS);
    });

    it("throws INVALID_DECIMALS for bad decimals", () => {
      const e1 = assertThrows(() => fromDecimals("1", -1));
      if (!(e1 instanceof ColibriError)) throw e1;
      assertEquals(e1.code, E.Code.INVALID_DECIMALS);

      const e2 = assertThrows(() => fromDecimals("1", 1.5));
      if (!(e2 instanceof ColibriError)) throw e2;
      assertEquals(e2.code, E.Code.INVALID_DECIMALS);
    });

    it("throws EMPTY_VALUE for empty/whitespace", () => {
      const e = assertThrows(() => fromDecimals("   ", 6));
      if (!(e instanceof ColibriError)) throw e;
      assertEquals(e.code, E.Code.EMPTY_VALUE);
    });

    it("throws INVALID_DECIMAL_INPUT for malformed inputs", () => {
      const cases = ["abc", ".", "+", "-", "1..2", "--1", "1-1", "1.2.3"];
      for (const value of cases) {
        const e = assertThrows(() => fromDecimals(value, 6));
        if (!(e instanceof ColibriError)) throw e;
        assertEquals(e.code, E.Code.INVALID_DECIMAL_INPUT);
      }
    });

    it("throws NON_FINITE_NUMBER for NaN/Infinity", () => {
      const e1 = assertThrows(() => fromDecimals(NaN, 6));
      if (!(e1 instanceof ColibriError)) throw e1;
      assertEquals(e1.code, E.Code.NON_FINITE_NUMBER);

      const e2 = assertThrows(() => fromDecimals(Infinity, 6));
      if (!(e2 instanceof ColibriError)) throw e2;
      assertEquals(e2.code, E.Code.NON_FINITE_NUMBER);
    });

    it("throws INVALID_SCIENTIFIC_NOTATION for malformed scientific strings", () => {
      const cases = ["1e", "1e+", "e3", "1E-", "1.2.3e4"];
      for (const value of cases) {
        const e = assertThrows(() => fromDecimals(value, 6));
        if (!(e instanceof ColibriError)) throw e;
        assertEquals(e.code, E.Code.INVALID_SCIENTIFIC_NOTATION);
      }
    });

    it("throws INVALID_SCIENTIFIC_EXPONENT when exponent overflows to Infinity", () => {
      // Need an exponent so large that Number(exponent) becomes Infinity.
      const hugeExp = "9".repeat(4000);
      const e = assertThrows(() => fromDecimals(`1e${hugeExp}`, 6));
      if (!(e instanceof ColibriError)) throw e;
      assertEquals(e.code, E.Code.INVALID_SCIENTIFIC_EXPONENT);
    });

    it("throws INVALID_SCIENTIFIC_EXPONENT when exponent exceeds MAX_EXPONENT_ABS", () => {
      const e = assertThrows(() => fromDecimals("1e1000001", 0));
      if (!(e instanceof ColibriError)) throw e;
      assertEquals(e.code, E.Code.INVALID_SCIENTIFIC_EXPONENT);
    });
  });

  describe("toDecimals", () => {
    it("formats and trims trailing zeros", () => {
      assertEquals(toDecimals(1230000n, 6), "1.23");
      assertEquals(toDecimals(1000000n, 6), "1");
      assertEquals(toDecimals(1n, 6), "0.000001");
    });

    it("handles decimals=0 and negative amounts", () => {
      assertEquals(toDecimals(123n, 0), "123");
      assertEquals(toDecimals(-1230000n, 6), "-1.23");
    });

    it("respects maxFractionDigits and trimTrailingZeros=false", () => {
      assertEquals(
        toDecimals(123456789n, 6, { maxFractionDigits: 2 }),
        "123.45"
      );
      assertEquals(
        toDecimals(1200000n, 6, { trimTrailingZeros: false }),
        "1.200000"
      );
    });

    it("supports maxFractionDigits=0 (drops fractional part)", () => {
      assertEquals(toDecimals(123456n, 4, { maxFractionDigits: 0 }), "12");
      assertEquals(toDecimals(-123456n, 4, { maxFractionDigits: 0 }), "-12");
    });

    it("throws INVALID_DECIMALS for bad decimals", () => {
      const e1 = assertThrows(() => toDecimals(1n, -1));
      if (!(e1 instanceof ColibriError)) throw e1;
      assertEquals(e1.code, E.Code.INVALID_DECIMALS);

      const e2 = assertThrows(() => toDecimals(1n, 2.2));
      if (!(e2 instanceof ColibriError)) throw e2;
      assertEquals(e2.code, E.Code.INVALID_DECIMALS);
    });

    it("throws INVALID_MAX_FRACTION_DIGITS", () => {
      const e1 = assertThrows(() =>
        toDecimals(1n, 6, { maxFractionDigits: -1 })
      );
      if (!(e1 instanceof ColibriError)) throw e1;
      assertEquals(e1.code, E.Code.INVALID_MAX_FRACTION_DIGITS);

      const e2 = assertThrows(() =>
        toDecimals(1n, 6, { maxFractionDigits: 1.5 })
      );
      if (!(e2 instanceof ColibriError)) throw e2;
      assertEquals(e2.code, E.Code.INVALID_MAX_FRACTION_DIGITS);
    });
  });

  describe("errors", () => {
    it("exports an error map and all errors extend ColibriError", () => {
      // Touch the map for coverage.
      assertEquals(typeof E.ERROR_HLP_UNT[E.Code.INVALID_DECIMALS], "function");

      const err = new E.ERROR_HLP_UNT[E.Code.INVALID_DECIMALS](0);
      if (!(err instanceof ColibriError)) throw err;
      if (!(err instanceof E.FormatUnitsError)) throw err;
      assertEquals(err.domain, "helpers");
      assertEquals(err.source, "@colibri/core/helpers/format-units");
    });

    it("covers all error classes", () => {
      const errors: E.FormatUnitsError[] = [
        new E.INVALID_DECIMALS(-1),
        new E.EMPTY_VALUE(""),
        new E.INVALID_DECIMAL_INPUT("bad"),
        new E.TOO_MANY_FRACTION_DIGITS("1.234", 2, 3),
        new E.NON_FINITE_NUMBER(Infinity),
        new E.INVALID_SCIENTIFIC_NOTATION("1e"),
        new E.INVALID_SCIENTIFIC_EXPONENT("1e999"),
        new E.INVALID_MAX_FRACTION_DIGITS(-1),
      ];

      for (const err of errors) {
        if (!(err instanceof ColibriError)) throw err;
        if (!(err instanceof E.FormatUnitsError)) throw err;
        // Touch a couple key fields so they're covered.
        assertEquals(err.domain, "helpers");
        assertEquals(err.source, "@colibri/core/helpers/format-units");
        assertEquals(typeof err.code, "string");
        assertEquals(typeof err.message, "string");
        assertEquals(typeof err.details, "string");
      }
    });
  });
});
