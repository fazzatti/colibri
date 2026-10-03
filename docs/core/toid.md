# TOID

Colibri exposes separate encodings for standard SEP-35 operation identifiers and
its historical RPC event/cursor convention. Choose the API that matches the
system storing or consuming the identifier. Both are decimal strings and should
be compared with `BigInt`, not JavaScript numbers.

## What Is A TOID?

The historical `TOID` packs ledger sequence, transaction application order and
**operation index minus one**. `createTOID` and `parseTOID` retain this
behavior. A
[`Sep35OperationId`](https://jsr.io/@colibri/core/doc/~/Sep35OperationId)
instead packs the one-based operation index directly, as SEP-35 specifies.

Both require a closed ledger's transaction order. They cannot predict an
operation's final position before inclusion.

## TOIDs And Event IDs

[Event IDs](../events/overview.md) combine the historical 19-character TOID with
a hyphen and a 10-character event index. Existing event IDs, cursor ordering and
[stream recovery](../packages/rpc-streamer/recovery.md) remain unchanged.

## Functions

### `createTOID`

Creates the historical RPC-compatible identifier from one-based components:

<!-- deno-check -->

```ts
import { createTOID } from "@colibri/core";
console.log(createTOID(123456, 1, 1)); // "0000530239482499072"
```

### `parseTOID`

Reverses the historical operation-index offset:

<!-- deno-check -->

```ts
import { parseTOID } from "@colibri/core";
console.log(parseTOID("0000530239482499072"));
// { ledgerSequence: 123456, transactionOrder: 1, operationIndex: 1 }
```

### `isTOID`

Checks decimal syntax and the shared nonnegative signed-64-bit range. It does
not certify that the packed fields identify a real operation. Whitespace, signs,
hexadecimal notation and fractional text are rejected. `parseSep35OperationId`
also rejects reserved zero transaction/operation fields.

## TOID Type

`TOID` and `Sep35OperationId` are different branded string types. Avoid casting
between them: equal operation locations produce different numeric strings. See
the [API reference](https://jsr.io/@colibri/core/doc/~/createSep35OperationId).

## Use Cases

Use the standard API for a system expecting SEP-35 identifiers, and the
historical API for existing Colibri event/cursor data. Keep a format label in
application schemas that store both. A migration of operation identifiers must
explicitly decode the source format, repack the same components and update all
related keys atomically; it must never rewrite RPC event cursors by inference.

## SEP-0035 Structure

SEP-35 stores `(ledger << 32) | (transactionOrder << 12) | operationIndex` with
the one-based operation index unchanged. Colibri returns a 19-digit padded
string while accepting unpadded decimal input when parsing.

<!-- deno-check -->

```ts
import { createSep35OperationId, parseSep35OperationId } from "@colibri/core";
const id = createSep35OperationId(1, 1, 1);
console.log(id); // "0000000004294971393"
console.log(parseSep35OperationId(id));
// { ledgerSequence: 1, transactionOrder: 1, operationIndex: 1 }
```

### Limits

| Component         | Accepted creation range |
| ----------------- | ----------------------- |
| Ledger sequence   | Integer 0–2,147,483,647 |
| Transaction order | Integer 1–1,048,575     |
| Operation index   | Integer 1–4,095         |

At the maximum components the standard ID is `9223372036854775807`. Invalid
components and malformed identifiers use the existing
[TOID typed errors](../reference/errors/core-toid.md). See
[SEP-35](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0035.md)
for the canonical specification.

## Working With Colibri Event IDs

Keep existing event construction on the historical path:

<!-- deno-check -->

```ts
import { createEventId, createTOID, parseEventId } from "@colibri/core";
const id = createEventId(createTOID(123456, 1, 1), 1);
console.log(id); // "0000530239482499072-0000000000"
console.log(parseEventId(id));
```

## Next Steps

- [Events](../events/overview.md) — Parse contract occurrences with retained
  IDs.
- [RPC Streamer](../packages/rpc-streamer.md) — Stream and resume with RPC
  cursors.
