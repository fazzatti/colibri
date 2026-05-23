# TOID

The TOID module provides utilities for working with SEP-0035 operation IDs.
Colibri uses the `TOID` type name for these encoded operation IDs, but SEP-0035
itself names the scheme "Operation IDs".

## What Is A TOID?

A TOID is a 64-bit signed integer, serialized by Colibri as a 19-character
zero-padded decimal string. It identifies one historical Stellar operation by
encoding three values:

- **Ledger sequence** (32 bits) — the ledger that contains the transaction.
- **Transaction application order** (20 bits) — the position assigned to the
  transaction within that closed ledger.
- **Operation index** (12 bits) — the position of the operation within its
  transaction.

This makes TOIDs useful for deterministic historical ordering after a ledger has
closed. They cannot be known before the transaction is included in a closed
ledger because the transaction application order is assigned by the network.

## TOIDs And Event IDs

TOIDs and Colibri event IDs are related, but they are not the same value.

- A `TOID` identifies an operation.
- An `EventId` identifies one event emitted by an operation.
- Colibri event IDs are formatted as
  `19-character TOID + "-" + 10-character event index`.

For example, `0000530239482499072` is a TOID. The event ID
`0000530239482499072-0000000000` points to the first event associated with that
operation.

## Functions

### `createTOID`

Create a TOID from operation-location components:

```typescript
import { createTOID } from "@colibri/core";

const toid = createTOID(
  123456, // ledgerSequence
  1, // transactionOrder, 1-based
  1, // operationIndex, 1-based
);

console.log(toid); // "0000530239482499072"
```

#### Signature

```typescript
function createTOID(
  ledgerSequence: number,
  transactionOrder: number,
  operationIndex: number,
): TOID;
```

#### Parameters

| Parameter          | Type     | Range             | Description                                      |
| ------------------ | -------- | ----------------- | ------------------------------------------------ |
| `ledgerSequence`   | `number` | 0 - 2,147,483,647 | Ledger sequence number                           |
| `transactionOrder` | `number` | 1 - 1,048,575     | Transaction application order in the ledger      |
| `operationIndex`   | `number` | 1 - 4,095         | Operation position inside the parent transaction |

#### Return Value

Returns a branded `TOID` string padded to 19 decimal characters.

### `parseTOID`

Parse a TOID back into its operation-location components:

```typescript
import { parseTOID } from "@colibri/core";

const parts = parseTOID("0000530239482499072");

console.log(parts);
// {
//   ledgerSequence: 123456,
//   transactionOrder: 1,
//   operationIndex: 1
// }
```

#### Signature

```typescript
function parseTOID(toid: string): {
  ledgerSequence: number;
  transactionOrder: number;
  operationIndex: number;
};
```

### `isTOID`

Check whether a string can be treated as a TOID:

```typescript
import { isTOID, parseTOID } from "@colibri/core";

if (isTOID(input)) {
  // input is now typed as TOID
  const parts = parseTOID(input);
}
```

## TOID Type

```typescript
type TOID = string & { __brand: "TOID" };
```

TOIDs are branded strings to prevent accidental misuse with arbitrary strings.

## Use Cases

### Operation Ordering

TOIDs can be compared as integers to order historical operations:

```typescript
operations.sort((a, b) => {
  const left = BigInt(a.toid);
  const right = BigInt(b.toid);
  return left < right ? -1 : left > right ? 1 : 0;
});
```

### Cursor-Based Pagination

Use TOIDs as operation cursors when paginating through historical data:

```typescript
const cursor = createTOID(60000000, 1, 1);

const operations = await getOperations({ cursor });
```

### Ledger Operation Ranges

Build the lowest and highest possible operation IDs for a ledger:

```typescript
const ledger = 60044284;
const firstToid = createTOID(ledger, 1, 1);
const lastToid = createTOID(ledger, 1048575, 4095);
```

## SEP-0035 Structure

SEP-0035 defines operation IDs as 64-bit signed integers:

```text
Bit Layout (64 bits total):
┌────────────────────────────┬──────────────────┬─────────────┐
│   Ledger Sequence (32)     │  TX Order (20)   │ Op Index(12)│
└────────────────────────────┴──────────────────┴─────────────┘
Bits:           63-32              31-12            11-0
```

### Limits

- Maximum ledger sequence: 2,147,483,647.
- Maximum transaction application order: 1,048,575.
- Maximum operation index: 4,095.

See
[SEP-0035](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0035.md)
for the canonical specification.

## Working With Colibri Event IDs

Use the event ID helpers when you need the event-level identifier:

```typescript
import { createEventId, createTOID, parseEventId } from "@colibri/core";

const toid = createTOID(123456, 1, 1);
const eventId = createEventId(toid, 1);

console.log(eventId); // "0000530239482499072-0000000000"
console.log(parseEventId(eventId));
// {
//   ledgerSequence: 123456,
//   transactionOrder: 1,
//   operationIndex: 1,
//   eventIndex: 0
// }
```

## Next Steps

- [Events](../events/overview.md) — Parse and work with Soroban contract events.
- [RPC Streamer](../packages/rpc-streamer.md) — Stream ledger and event data.
