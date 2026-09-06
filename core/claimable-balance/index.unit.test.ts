import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertThrows,
} from "@std/assert";
import { describe, it } from "@std/testing/bdd";
import { Claimant, xdr } from "stellar-sdk";
import { ClaimableBalancePredicates as P } from "@/claimable-balance/index.ts";
import * as E from "@/claimable-balance/error.ts";
import { validateClaimPredicate } from "@/claimable-balance/validate.ts";
import type { ClaimPredicate } from "@/claimable-balance/types.ts";

describe("ClaimableBalancePredicates", () => {
  it("composes lists as balanced native trees without changing condition order", () => {
    const predicates = Object.freeze(
      Array.from({ length: 8 }, (_, i) => P.beforeAbsoluteTime(i + 1)),
    );
    const expectedAnd = Claimant.predicateAnd(
      Claimant.predicateAnd(
        Claimant.predicateAnd(predicates[0], predicates[1]),
        Claimant.predicateAnd(predicates[2], predicates[3]),
      ),
      Claimant.predicateAnd(
        Claimant.predicateAnd(predicates[4], predicates[5]),
        Claimant.predicateAnd(predicates[6], predicates[7]),
      ),
    );
    assertEquals(
      P.allOf(predicates).toXdr("base64"),
      expectedAnd.toXdr("base64"),
    );
    const expectedOr = Claimant.predicateOr(
      predicates[0],
      Claimant.predicateOr(predicates[1], predicates[2]),
    );
    assertEquals(
      P.anyOf(predicates.slice(0, 3)).toXdr("base64"),
      expectedOr.toXdr("base64"),
    );
    assertEquals(P.allOf([predicates[0]]), predicates[0]);
    assertThrows(() => P.allOf([]), E.EMPTY_ALL_OF);
    assertThrows(() => P.anyOf([]), E.EMPTY_ANY_OF);
    assertThrows(
      () => P.allOf([...predicates, P.unconditional()]),
      E.EXCESSIVE_DEPTH,
    );
    assertThrows(
      () =>
        P.anyOf([P.not(P.not(P.not(P.unconditional()))), P.unconditional()]),
      E.EXCESSIVE_DEPTH,
    );
    assertThrows(() => P.allOf([{} as ClaimPredicate]), E.INVALID_PREDICATE);
  });

  it("expresses inclusive starts and exclusive ends at ledger-close precision", () => {
    const start = new Date(10_000);
    const end = new Date(20_000);
    assertEquals(
      P.atOrAfter(start).toXdr("base64"),
      Claimant.predicateNot(Claimant.predicateBeforeAbsoluteTime("10")).toXdr(
        "base64",
      ),
    );
    assertEquals(
      P.between({ start, end }).toXdr("base64"),
      P.and(P.not(P.beforeAbsoluteTime(10)), P.beforeAbsoluteTime(20)).toXdr(
        "base64",
      ),
    );
    for (
      const [start, end] of [[new Date(20_000), new Date(10_000)], [
        new Date(10_001),
        new Date(10_999),
      ], [new Date(10_000), new Date(10_000)]]
    ) assertThrows(() => P.between({ start, end }), E.EMPTY_TIME_WINDOW);
    assertThrows(
      () => P.between({ start: new Date(NaN), end }),
      E.INVALID_DATE,
    );
    assertThrows(
      () => P.between({ start, end: new Date(NaN) }),
      E.INVALID_DATE,
    );
    for (
      const error of [
        new E.EMPTY_ALL_OF(),
        new E.EMPTY_ANY_OF(),
        new E.EMPTY_TIME_WINDOW(),
      ]
    ) assertEquals(E.ERROR_CBPR[error.code], error.constructor);
  });

  it("returns native SDK predicates with exact absolute and relative seconds", () => {
    assertEquals(
      P.unconditional().toXdr("base64"),
      Claimant.predicateUnconditional().toXdr("base64"),
    );
    for (const seconds of [0, 1, "20", 30n, "9223372036854775807"]) {
      assertEquals(
        P.beforeAbsoluteTime(seconds).toXdr("base64"),
        Claimant.predicateBeforeAbsoluteTime(String(seconds)).toXdr("base64"),
      );
      assertEquals(
        P.beforeRelativeTime(seconds).toXdr("base64"),
        Claimant.predicateBeforeRelativeTime(String(seconds)).toXdr("base64"),
      );
      validateClaimPredicate(P.beforeAbsoluteTime(seconds));
      validateClaimPredicate(P.beforeRelativeTime(seconds));
    }
  });

  it("maps Date deadlines to equivalent strict comparisons at whole-second ledger times", () => {
    for (
      const milliseconds of [0, 1000, 1001, 1999, 2000, 8_640_000_000_000_000]
    ) {
      const predicate = P.before(new Date(milliseconds));
      assert(predicate.type === "claimPredicateBeforeAbsoluteTime");
      const expected = BigInt(Math.ceil(milliseconds / 1000));
      assertEquals(predicate.absBefore, expected);
      for (const ledgerTime of [expected - 1n, expected, expected + 1n]) {
        assertEquals(
          ledgerTime < predicate.absBefore,
          Number(ledgerTime) * 1000 < milliseconds,
        );
      }
    }
    for (
      const date of [
        new Date(NaN),
        new Date(-1),
        "2026-09-05" as unknown as Date,
      ]
    ) {
      assertThrows(() => P.before(date), E.INVALID_DATE);
    }
  });

  it("rejects negative, fractional, unsafe, malformed, and overflowing seconds", () => {
    for (
      const invalid of [
        -1,
        -1n,
        0.5,
        NaN,
        Infinity,
        Number.MAX_SAFE_INTEGER + 1,
        "",
        "-1",
        "1.0",
        " 1",
        "1e3",
        "9223372036854775808",
      ]
    ) {
      assertThrows(
        () => P.beforeAbsoluteTime(invalid),
        E.INVALID_ABSOLUTE_TIME,
      );
      assertThrows(
        () => P.beforeRelativeTime(invalid),
        E.INVALID_RELATIVE_TIME,
      );
    }
  });

  it("composes native predicates without modifying their children", () => {
    const before = Claimant.predicateBeforeAbsoluteTime("1000");
    const relative = Claimant.predicateBeforeRelativeTime("600");
    const beforeXdr = before.toXdr("base64");
    const and = P.and(before, relative);
    const or = P.or(before, P.not(relative));
    assertInstanceOf(and, xdr.ClaimPredicate);
    assertEquals(
      and.toXdr("base64"),
      Claimant.predicateAnd(before, relative).toXdr("base64"),
    );
    assertEquals(
      or.toXdr("base64"),
      Claimant.predicateOr(before, Claimant.predicateNot(relative)).toXdr(
        "base64",
      ),
    );
    assertEquals(before.toXdr("base64"), beforeXdr);
    validateClaimPredicate(P.unconditional());
  });

  it("accepts four levels including the root and rejects a fifth", () => {
    const levelTwo = P.not(P.unconditional());
    const levelThree = P.and(levelTwo, P.unconditional());
    const levelFour = P.or(levelThree, P.unconditional());
    validateClaimPredicate(levelFour);
    assertThrows(() => P.not(levelFour), E.EXCESSIVE_DEPTH);
    assertThrows(() => P.and(P.unconditional(), levelFour), E.EXCESSIVE_DEPTH);
    assertThrows(() => P.or(levelFour, P.unconditional()), E.EXCESSIVE_DEPTH);
  });

  it("validates malformed native children, not only its own generated trees", () => {
    assertThrows(
      () => P.and({} as ClaimPredicate, P.unconditional()),
      E.INVALID_PREDICATE,
    );
    assertThrows(
      () => P.not(xdr.ClaimPredicate.claimPredicateAnd([])),
      E.INVALID_AND_ARITY,
    );
    assertThrows(
      () => P.not(xdr.ClaimPredicate.claimPredicateOr([P.unconditional()])),
      E.INVALID_OR_ARITY,
    );
    assertThrows(
      () => P.not(xdr.ClaimPredicate.claimPredicateNot(null)),
      E.EMPTY_NOT,
    );
    for (const seconds of [-1n, 9_223_372_036_854_775_808n]) {
      assertThrows(
        () =>
          P.not(xdr.ClaimPredicate.claimPredicateBeforeAbsoluteTime(seconds)),
        E.INVALID_ABSOLUTE_PREDICATE,
      );
      assertThrows(
        () =>
          P.not(xdr.ClaimPredicate.claimPredicateBeforeRelativeTime(seconds)),
        E.INVALID_RELATIVE_PREDICATE,
      );
    }
  });

  it("exposes a distinct stable constructor for each error code", () => {
    const errors = [
      new E.INVALID_DATE(null),
      new E.INVALID_ABSOLUTE_TIME(-1),
      new E.INVALID_RELATIVE_TIME(-1),
      new E.INVALID_PREDICATE(null),
      new E.EXCESSIVE_DEPTH(5),
      new E.INVALID_AND_ARITY(1),
      new E.INVALID_OR_ARITY(1),
      new E.EMPTY_NOT(),
      new E.INVALID_ABSOLUTE_PREDICATE(-1n),
      new E.INVALID_RELATIVE_PREDICATE(-1n),
    ];
    assertEquals(
      new Set(errors.map((error) => error.code)).size,
      errors.length,
    );
    for (const error of errors) {
      assertEquals(E.ERROR_CBPR[error.code], error.constructor);
      assertEquals(error.source, "@colibri/core/claimable-balance");
    }
  });
});
