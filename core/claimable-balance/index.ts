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

export type { ClaimPredicateSeconds } from "@/claimable-balance/types.ts";
