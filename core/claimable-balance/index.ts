import { Claimant } from "stellar-sdk";
import type {
  ClaimPredicate,
  ClaimPredicateSeconds,
} from "@/claimable-balance/types.ts";
import {
  parsePredicateSeconds,
  validateClaimPredicate,
} from "@/claimable-balance/validate.ts";
import * as E from "@/claimable-balance/error.ts";

/**
 * Discoverable claimable-balance predicate helpers returning native SDK XDR.
 *
 * Compose these with the native SDK `Claimant` and `Operation` constructors.
 * Predicates determine whether a claim is eligible at its execution ledger;
 * they do not schedule transactions or automatically refund funds.
 */
export class ClaimableBalancePredicates {
  /**
   * Combines a nonempty list into a balanced native AND tree, preserving order.
   * An empty list is rejected rather than silently authorizing a claim.
   */
  static allOf(predicates: readonly ClaimPredicate[]): ClaimPredicate {
    if (predicates.length === 0) throw new E.EMPTY_ALL_OF();
    return combinePredicates(predicates, ClaimableBalancePredicates.and);
  }

  /** Combines a nonempty list into a balanced native OR tree, preserving order. */
  static anyOf(predicates: readonly ClaimPredicate[]): ClaimPredicate {
    if (predicates.length === 0) throw new E.EMPTY_ANY_OF();
    return combinePredicates(predicates, ClaimableBalancePredicates.or);
  }

  /** Permits claims at or after a Date, based on the execution ledger's close time. */
  static atOrAfter(start: Date): ClaimPredicate {
    return ClaimableBalancePredicates.not(
      ClaimableBalancePredicates.before(start),
    );
  }

  /**
   * Permits claims in [start, end): the start is inclusive and the end exclusive.
   * This is a time condition, not a scheduled transaction or automatic refund.
   */
  static between({ start, end }: { start: Date; end: Date }): ClaimPredicate {
    const afterStart = ClaimableBalancePredicates.atOrAfter(start);
    const beforeEnd = ClaimableBalancePredicates.before(end);
    if (Math.ceil(start.getTime() / 1000) >= Math.ceil(end.getTime() / 1000)) {
      throw new E.EMPTY_TIME_WINDOW();
    }
    return ClaimableBalancePredicates.and(afterStart, beforeEnd);
  }

  /** Returns the native predicate that permits claiming without a time condition. */
  static unconditional(): ClaimPredicate {
    return Claimant.predicateUnconditional();
  }

  /**
   * Permits claims whose ledger close time is strictly before `deadline`.
   * Stellar close times have whole-second precision; a fractional-second Date
   * is rounded up, preserving strict-before comparisons against integer times.
   */
  static before(deadline: Date): ClaimPredicate {
    const milliseconds = deadline instanceof Date ? deadline.getTime() : NaN;
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new E.INVALID_DATE(deadline);
    }
    return Claimant.predicateBeforeAbsoluteTime(
      String(Math.ceil(milliseconds / 1000)),
    );
  }

  /** Permits claims strictly before these absolute Unix seconds (not milliseconds). */
  static beforeAbsoluteTime(seconds: ClaimPredicateSeconds): ClaimPredicate {
    const value = parsePredicateSeconds(seconds);
    if (value === null) throw new E.INVALID_ABSOLUTE_TIME(seconds);
    return Claimant.predicateBeforeAbsoluteTime(String(value));
  }

  /**
   * Permits claims before this many seconds after the balance's creation ledger
   * close time. The duration is not measured from this local method call.
   */
  static beforeRelativeTime(seconds: ClaimPredicateSeconds): ClaimPredicate {
    const value = parsePredicateSeconds(seconds);
    if (value === null) throw new E.INVALID_RELATIVE_TIME(seconds);
    return Claimant.predicateBeforeRelativeTime(String(value));
  }

  /** Requires both native predicates; validates the resulting four-level limit. */
  static and(left: ClaimPredicate, right: ClaimPredicate): ClaimPredicate {
    validateClaimPredicate(left, 2);
    validateClaimPredicate(right, 2);
    return Claimant.predicateAnd(left, right);
  }

  /** Permits either native predicate; validates the resulting four-level limit. */
  static or(left: ClaimPredicate, right: ClaimPredicate): ClaimPredicate {
    validateClaimPredicate(left, 2);
    validateClaimPredicate(right, 2);
    return Claimant.predicateOr(left, right);
  }

  /** Negates a native predicate; `not(before(...))` includes the exact deadline. */
  static not(child: ClaimPredicate): ClaimPredicate {
    validateClaimPredicate(child, 2);
    return Claimant.predicateNot(child);
  }
}

function combinePredicates(
  predicates: readonly ClaimPredicate[],
  combine: (left: ClaimPredicate, right: ClaimPredicate) => ClaimPredicate,
): ClaimPredicate {
  if (predicates.length === 1) {
    validateClaimPredicate(predicates[0]);
    return predicates[0];
  }
  const middle = Math.floor(predicates.length / 2);
  return combine(
    combinePredicates(predicates.slice(0, middle), combine),
    combinePredicates(predicates.slice(middle), combine),
  );
}

export type { ClaimPredicateSeconds } from "@/claimable-balance/types.ts";
