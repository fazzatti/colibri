import type { xdr } from "stellar-sdk";

/** @internal Exact native SDK predicate, accepted by its Claimant constructor. */
export type ClaimPredicate = xdr.ClaimPredicate;

/** Whole, nonnegative seconds; strings and bigint preserve the full int64 range. */
export type ClaimPredicateSeconds = string | number | bigint;
