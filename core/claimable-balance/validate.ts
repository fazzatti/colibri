import { xdr } from "stellar-sdk";
import type {
  ClaimPredicate,
  ClaimPredicateSeconds,
} from "@/claimable-balance/types.ts";
import * as E from "@/claimable-balance/error.ts";

const MAX_INT64 = 9_223_372_036_854_775_807n;

/** @internal Parse exact seconds without accepting rounded JS numbers. */
export function parsePredicateSeconds(
  value: ClaimPredicateSeconds,
): bigint | null {
  if (typeof value === "number" && !Number.isSafeInteger(value)) return null;
  if (!/^\d+$/.test(String(value))) return null;
  const seconds = BigInt(value);
  return seconds > MAX_INT64 ? null : seconds;
}

function validateChildren(
  children: readonly ClaimPredicate[],
  depth: number,
): void {
  for (const child of children) validateClaimPredicate(child, depth + 1);
}

function isValidNativeTime(seconds: bigint): boolean {
  return seconds >= 0n && seconds <= MAX_INT64;
}

/** @internal Enforce the protocol's depth, arity, and nonnegative time rules. */
export function validateClaimPredicate(
  predicate: ClaimPredicate,
  depth = 1,
): void {
  if (!(predicate instanceof xdr.ClaimPredicate)) {
    throw new E.INVALID_PREDICATE(predicate);
  }
  if (depth > 4) throw new E.EXCESSIVE_DEPTH(depth);
  switch (predicate.type) {
    case "claimPredicateUnconditional":
      return;
    case "claimPredicateAnd":
      if (predicate.andPredicates.length !== 2) {
        throw new E.INVALID_AND_ARITY(predicate.andPredicates.length);
      }
      return validateChildren(predicate.andPredicates, depth);
    case "claimPredicateOr":
      if (predicate.orPredicates.length !== 2) {
        throw new E.INVALID_OR_ARITY(predicate.orPredicates.length);
      }
      return validateChildren(predicate.orPredicates, depth);
    case "claimPredicateNot":
      if (!predicate.notPredicate) throw new E.EMPTY_NOT();
      return validateClaimPredicate(predicate.notPredicate, depth + 1);
    case "claimPredicateBeforeAbsoluteTime":
      if (!isValidNativeTime(predicate.absBefore)) {
        throw new E.INVALID_ABSOLUTE_PREDICATE(predicate.absBefore);
      }
      return;
    case "claimPredicateBeforeRelativeTime":
      if (!isValidNativeTime(predicate.relBefore)) {
        throw new E.INVALID_RELATIVE_PREDICATE(predicate.relBefore);
      }
      return;
  }
}
