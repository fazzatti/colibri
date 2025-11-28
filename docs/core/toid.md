# TOID

The TOID module provides utilities for working with SEP-0035 Total Order IDs — unique identifiers for operations across the Stellar network.

## What is a TOID?

A TOID (Total Order ID) is a 64-bit integer that uniquely identifies any operation on the Stellar network. It encodes three pieces of information:

- **Ledger Sequence** (32 bits) — Which ledger the operation was in
- **Transaction Order** (20 bits) — Position of the transaction within the ledger
- **Operation Index** (12 bits) — Position of the operation within the transaction

## Functions

### `createTOID`

Generate a TOID from its component parts:

```typescript
import { createTOID } from "@colibri/core";

const toid = createTOID(
  123456, // ledgerSequence
  1, // transactionOrder (1-based)
  1 // operationIndex (1-based)
);

console.log(toid); // "0000530242871959553"
```

#### Signature

```typescript
function createTOID(
  ledgerSequence: number,
  transactionOrder: number,
  operationIndex: number
): TOID;
```

#### Parameters

| Parameter          | Type     | Range             | Description                                 |
| ------------------ | -------- | ----------------- | ------------------------------------------- |
| `ledgerSequence`   | `number` | 0 - 2,147,483,647 | Ledger sequence number                      |
| `transactionOrder` | `number` | 1 - 1,048,575     | Transaction position in ledger (1-based)    |
| `operationIndex`   | `number` | 1 - 4,095         | Operation position in transaction (1-based) |

#### Return Value

Returns a 19-character zero-padded string representing the TOID.

### `parseTOID`

Parse a TOID back into its component parts:

```typescript
import { parseTOID } from "@colibri/core";

const parts = parseTOID("0000530242871959553");

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

Check if a string is a valid TOID:

```typescript
import { isTOID } from "@colibri/core";

if (isTOID(input)) {
  // input is now typed as TOID
  const parts = parseTOID(input);
}
```

## TOID Type

```typescript
type TOID = string & { __brand: "TOID" };
```

TOIDs are branded strings to prevent accidental misuse.

## Use Cases

### Event Ordering

TOIDs allow you to order events chronologically across the entire network:

```typescript
// Events can be sorted by their TOIDs
events.sort((a, b) => {
  return BigInt(a.toid) - BigInt(b.toid);
});
```

### Cursor-Based Pagination

Use TOIDs as cursors when paginating through historical data:

```typescript
// Start from a specific point
const startToid = createTOID(60000000, 1, 1);

// Query events after this TOID
const events = await getEvents({ cursor: startToid });
```

### Transaction Identification

Identify specific operations across the network:

`typescript\n// Find all operations in a specific ledger\nconst ledger = 60044284;\nconst firstToid = createTOID(ledger, 1, 1);\nconst lastToid = createTOID(ledger, 1048575, 4095);\n\n// Query between these TOIDs\n`\n\n## SEP-0035 Specification

The TOID format is defined in [SEP-0035](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0035.md):

```
Bit Layout (64 bits total):
┌────────────────────────────┬──────────────────┬─────────────┐
│   Ledger Sequence (32)     │  TX Order (20)   │  Op Idx (12)│
└────────────────────────────┴──────────────────┴─────────────┘
Bits:           63-32              31-12            11-0
```

### Limits

- Maximum ledger: 2,147,483,647 (2^31 - 1)
- Maximum transactions per ledger: 1,048,575 (2^20 - 1)
- Maximum operations per transaction: 4,095 (2^12 - 1)

## Examples

### Convert Event ID to TOID

```typescript
// Event IDs from RPC are already TOIDs
const eventId = "0000530242871959553";

if (isTOID(eventId)) {
  const { ledgerSequence, transactionOrder, operationIndex } =
    parseTOID(eventId);
  console.log(`Ledger: ${ledgerSequence}`);
  console.log(`TX #${transactionOrder}, Op #${operationIndex}`);
}
```

### Create Range for Ledger Query

```typescript
function getToidRange(ledger: number) {
  return {
    start: createTOID(ledger, 1, 1),
    end: createTOID(ledger + 1, 1, 1),
  };
}

const { start, end } = getToidRange(60044284);
// Query all events where start <= toid < end
```

## Next Steps

- [Event Streamer](../packages/event-streamer.md) — Use TOIDs for event pagination
- [Events Overview](../events/overview.md) — Understand event identification
