# Claimable-balance predicates

`ClaimableBalancePredicates` groups helpers for conditions on native Stellar
claimable balances. Every method returns the Stellar SDK's `xdr.ClaimPredicate`,
so you can pass it directly to a native `Claimant` and mix it with SDK
predicates.

API:
[ClaimableBalancePredicates on JSR](https://jsr.io/@colibri/core/doc/~/ClaimableBalancePredicates).

## Payment deadline and explicit reclaim path

The following is a construction fragment. `sender` and `recipient` are existing
Stellar G account IDs. Pass the operation to an existing
[classic transaction pipeline](pipelines/classic-transaction.md), configured
with a funded sender, its signer, fee, and timeout. No transaction is submitted
by the predicate helpers themselves.

```typescript
import { ClaimableBalancePredicates } from "@colibri/core";
import { Asset, Claimant, Operation } from "npm:@stellar/stellar-sdk@^17.0.1";

const deadline = new Date("2030-01-01T00:00:00Z");
const beforeDeadline = ClaimableBalancePredicates.before(deadline);

const operation = Operation.createClaimableBalance({
  asset: Asset.native(),
  amount: "10",
  claimants: [
    new Claimant(recipient, beforeDeadline),
    new Claimant(sender, ClaimableBalancePredicates.not(beforeDeadline)),
  ],
});
```

The recipient can claim before the deadline. The sender can reclaim at or after
it. **There is no automatic refund:** the eligible account must submit
`Operation.claimClaimableBalance`. The first successful claim consumes the whole
balance. The transaction pipeline's `createClaimableBalance` outcome exposes its
native balance ID; retain it for the subsequent claim.

## Methods and units

| Method                        | Meaning                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `unconditional()`             | No predicate time restriction.                                                   |
| `before(date)`                | The claiming ledger closes strictly before this `Date`.                          |
| `beforeAbsoluteTime(seconds)` | Strictly before absolute Unix seconds, not milliseconds.                         |
| `beforeRelativeTime(seconds)` | Strictly before this duration after the balance's creation ledger closes.        |
| `and(left, right)`            | Both predicates must hold.                                                       |
| `or(left, right)`             | Either predicate may hold.                                                       |
| `not(predicate)`              | Negates the predicate, including its exact time boundary.                        |
| `atOrAfter(date)`             | Includes the start time by negating `before(date)`.                              |
| `between({ start, end })`     | Includes the start and excludes the end. Rejects an empty whole-second window.   |
| `allOf(predicates)`           | Requires all members of a nonempty list, composed as a balanced native AND tree. |
| `anyOf(predicates)`           | Permits any member of a nonempty list, composed as a balanced native OR tree.    |

Absolute and relative seconds accept decimal integer strings, `bigint`, or safe
integer numbers. They must fit the protocol's nonnegative signed-64-bit range.
Fractional, negative, overflowing, and unsafe numeric inputs fail with typed
`CBPR_*` errors instead of being rounded.

`Date` is the one subsecond input form. Stellar ledger close times are integer
seconds, so a fractional-second Date is rounded up to preserve the exact
strict-before comparison against those integer timestamps. For example, a
deadline at `00:00:01.500Z` permits a ledger at second `1` but not second `2`.
Relative durations begin at the creation ledger's close time, not at the local
time when you construct the predicate.

## Composition limits and interoperability

The protocol permits four tree levels including the root. AND and OR require
exactly two children; NOT requires a non-null child. The composition helpers
validate these rules for the complete resulting tree, including children built
directly with the native SDK. They do not mutate input predicates, collapse
expressions, or change the network's authorization semantics.

For example, a claim can be eligible in either of two explicit time windows:

<!-- deno-check -->

```typescript
import { ClaimableBalancePredicates as P } from "@colibri/core";

const window = P.between({
  start: new Date("2030-01-01T00:00:00Z"),
  end: new Date("2030-02-01T00:00:00Z"),
});
const later = P.atOrAfter(new Date("2030-03-01T00:00:00Z"));
const eitherWindow = P.anyOf([window, later]);
console.log(eitherWindow.toXdr("base64"));
```

List helpers preserve condition order and use balanced trees to avoid wasting
depth on left-associated chains. Eight leaf predicates fit the four-level limit;
nested children can reduce the available capacity. Empty lists fail explicitly,
rather than silently becoming unconditional or impossible claims. They do not
simplify logical expressions to bypass the protocol's depth limit.

The native SDK remains available when you need raw construction. Claimant count,
duplicate destinations, source balances, reserve requirements, asset
authorization, and claim eligibility at execution are separate protocol checks,
not promises made by predicate construction. An application must still handle a
claim becoming ineligible before its transaction is included.
