import { ColibriError } from "@/error/index.ts";

/** Stable errors for claimable-balance predicate construction. */
export enum Code {
  INVALID_DATE = "CBPR_001",
  INVALID_ABSOLUTE_TIME = "CBPR_002",
  INVALID_RELATIVE_TIME = "CBPR_003",
  INVALID_PREDICATE = "CBPR_004",
  EXCESSIVE_DEPTH = "CBPR_005",
  INVALID_AND_ARITY = "CBPR_006",
  INVALID_OR_ARITY = "CBPR_007",
  EMPTY_NOT = "CBPR_008",
  INVALID_ABSOLUTE_PREDICATE = "CBPR_009",
  INVALID_RELATIVE_PREDICATE = "CBPR_010",
}

/** Base error for a specific predicate-construction or validation failure. */
export abstract class ClaimableBalancePredicateError<C extends Code>
  extends ColibriError<C> {
  /** Records the protocol rule and input associated with the failure. */
  constructor(code: C, message: string, value: unknown) {
    super({
      domain: "core",
      source: "@colibri/core/claimable-balance",
      code,
      message,
      meta: { data: { value } },
    });
  }
}

/** A Date is invalid or is before the Unix epoch. */
export class INVALID_DATE
  extends ClaimableBalancePredicateError<Code.INVALID_DATE> {
  /** Records the supplied date. */
  constructor(value: unknown) {
    super(
      Code.INVALID_DATE,
      "Provide a valid Date at or after the Unix epoch.",
      value,
    );
  }
}
/** Absolute seconds must be a nonnegative signed int64 without precision loss. */
export class INVALID_ABSOLUTE_TIME
  extends ClaimableBalancePredicateError<Code.INVALID_ABSOLUTE_TIME> {
  /** Records invalid absolute seconds. */
  constructor(value: unknown) {
    super(
      Code.INVALID_ABSOLUTE_TIME,
      "Absolute time must be whole nonnegative int64 Unix seconds.",
      value,
    );
  }
}
/** Relative seconds must be a nonnegative signed int64 without precision loss. */
export class INVALID_RELATIVE_TIME
  extends ClaimableBalancePredicateError<Code.INVALID_RELATIVE_TIME> {
  /** Records invalid relative seconds. */
  constructor(value: unknown) {
    super(
      Code.INVALID_RELATIVE_TIME,
      "Relative time must be whole nonnegative int64 seconds.",
      value,
    );
  }
}
/** A supplied child is not a native SDK ClaimPredicate. */
export class INVALID_PREDICATE
  extends ClaimableBalancePredicateError<Code.INVALID_PREDICATE> {
  /** Records the invalid native predicate input. */
  constructor(value: unknown) {
    super(
      Code.INVALID_PREDICATE,
      "Provide a native Stellar SDK ClaimPredicate.",
      value,
    );
  }
}
/** A predicate tree exceeds Stellar's four levels, counting its root as one. */
export class EXCESSIVE_DEPTH
  extends ClaimableBalancePredicateError<Code.EXCESSIVE_DEPTH> {
  /** Records the first level beyond the protocol maximum. */
  constructor(value: number) {
    super(
      Code.EXCESSIVE_DEPTH,
      "Claimable-balance predicate trees have at most four levels.",
      value,
    );
  }
}
/** A native AND predicate does not have exactly two children. */
export class INVALID_AND_ARITY
  extends ClaimableBalancePredicateError<Code.INVALID_AND_ARITY> {
  /** Records the supplied child count. */
  constructor(value: number) {
    super(
      Code.INVALID_AND_ARITY,
      "An AND predicate requires exactly two children.",
      value,
    );
  }
}
/** A native OR predicate does not have exactly two children. */
export class INVALID_OR_ARITY
  extends ClaimableBalancePredicateError<Code.INVALID_OR_ARITY> {
  /** Records the supplied child count. */
  constructor(value: number) {
    super(
      Code.INVALID_OR_ARITY,
      "An OR predicate requires exactly two children.",
      value,
    );
  }
}
/** A native NOT predicate has no child. */
export class EMPTY_NOT extends ClaimableBalancePredicateError<Code.EMPTY_NOT> {
  /** Records the empty native predicate. */
  constructor() {
    super(Code.EMPTY_NOT, "A NOT predicate requires one child.", null);
  }
}
/** A supplied native absolute-time predicate has invalid int64 seconds. */
export class INVALID_ABSOLUTE_PREDICATE
  extends ClaimableBalancePredicateError<Code.INVALID_ABSOLUTE_PREDICATE> {
  /** Records the invalid native predicate time. */
  constructor(value: bigint) {
    super(
      Code.INVALID_ABSOLUTE_PREDICATE,
      "Native absolute predicate time must be nonnegative int64 seconds.",
      value,
    );
  }
}
/** A supplied native relative-time predicate has invalid int64 seconds. */
export class INVALID_RELATIVE_PREDICATE
  extends ClaimableBalancePredicateError<Code.INVALID_RELATIVE_PREDICATE> {
  /** Records the invalid native predicate time. */
  constructor(value: bigint) {
    super(
      Code.INVALID_RELATIVE_PREDICATE,
      "Native relative predicate time must be nonnegative int64 seconds.",
      value,
    );
  }
}

/** Predicate errors indexed by stable code. */
export const ERROR_CBPR = {
  [Code.INVALID_DATE]: INVALID_DATE,
  [Code.INVALID_ABSOLUTE_TIME]: INVALID_ABSOLUTE_TIME,
  [Code.INVALID_RELATIVE_TIME]: INVALID_RELATIVE_TIME,
  [Code.INVALID_PREDICATE]: INVALID_PREDICATE,
  [Code.EXCESSIVE_DEPTH]: EXCESSIVE_DEPTH,
  [Code.INVALID_AND_ARITY]: INVALID_AND_ARITY,
  [Code.INVALID_OR_ARITY]: INVALID_OR_ARITY,
  [Code.EMPTY_NOT]: EMPTY_NOT,
  [Code.INVALID_ABSOLUTE_PREDICATE]: INVALID_ABSOLUTE_PREDICATE,
  [Code.INVALID_RELATIVE_PREDICATE]: INVALID_RELATIVE_PREDICATE,
};
