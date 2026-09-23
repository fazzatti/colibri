# Events Overview

Use [event filters](event-filter.md) to select data and
[event templates](templates.md) to decode an application's schema. For
continuous delivery, see [RPC Streamer](../packages/rpc-streamer.md). Parsing an
event does not itself establish trust in the emitting contract.

Colibri provides tools for filtering and parsing Soroban contract events.

For already downloaded ledger data, use
[offline extraction](#extract-events-from-saved-ledger-metadata) without
starting a stream or querying RPC.

## Event Structure

Soroban events consist of:

- **Contract ID** — Which contract emitted the event
- **Type** — [`Contract`](../core/contract.md) or `System`
- **Topics** — Indexed values for filtering (max 4)
- **Data** — The event payload

## EventFilter

Create filters to specify which events to capture:

```typescript
import { EventFilter, EventType } from "@colibri/core";

const filter = new EventFilter({
  contractIds: ["CABC..."],
  type: EventType.Contract,
  topics: [topicFilter],
});
```

## Topic Wildcards

| Wildcard | Meaning                         |
| -------- | ------------------------------- |
| `"*"`    | Match any single topic          |
| `"**"`   | Match remaining topics (at end) |

## Standardized Events

Colibri ships with parsers for Stellar ecosystem standards:

| Standard                                | Description                    |
| --------------------------------------- | ------------------------------ |
| [SAC](standardized-events/sac.md)       | Stellar Asset Contract events  |
| [SEP-41](standardized-events/sep-41.md) | Soroban Token Interface events |

See [Standardized Events](standardized-events/README.md) for details on using
these parsers.

## Extract events from saved ledger metadata

[`parseEventsFromLedgerCloseMeta`](https://jsr.io/@colibri/core/doc/events/~/parseEventsFromLedgerCloseMeta)
accepts a **decoded** native SDK `xdr.LedgerCloseMeta`, a callback, and optional
[`EventFilter[]`](event-filter.md). When starting with a base64 XDR string,
decode it first. The parser reads existing metadata locally and awaits each
callback; it does not request or submit transactions.

This complete script consumes a caller-supplied base64 metadata file. Install
[Core and Stellar SDK](../getting-started/installation.md), save it as
`offline-events.ts`, and run
`deno run --allow-read=./ledger-meta.xdr offline-events.ts ./ledger-meta.xdr`.

<!-- deno-check -->

```ts
import {
  EventFilter,
  EventType,
  parseEventsFromLedgerCloseMeta,
} from "@colibri/core";
import { xdr } from "npm:@stellar/stellar-sdk";

const path = Deno.args[0] ?? "./ledger-meta.xdr";
const encoded = (await Deno.readTextFile(path)).trim();
const metadata = xdr.LedgerCloseMeta.fromXdr(encoded, "base64");
await parseEventsFromLedgerCloseMeta(
  metadata,
  (event) => {
    if (event.inSuccessfulContractCall) {
      console.log(event.id, event.value);
    }
  },
  [new EventFilter({ type: EventType.Contract })],
);
```

The current extractor supports ledger-close metadata v1/v2 containing
transaction metadata v4. Unsupported versions throw
[event-parsing errors](../reference/errors/core-event-parsing.md); decoding XDR
does not convert an older metadata layout into a supported one. Failed-call
events can reach the callback, so inspect `inSuccessfulContractCall` when that
distinction matters. Schema parsing also does not establish emitter identity;
apply the [delivery checks](templates.md#delivery-is-not-authorization) required
by your application.

Callbacks receive the same Core [`Event`](templates.md) used by
[templates](templates.md),
[spec-derived event definitions](../core/contract/events.md) and
[RPC Streamer](../packages/rpc-streamer/events.md). Use the
[ledger parser](../core/ledger-parser.md) when you also need transaction or
operation inspection.

For an already decoded array of diagnostic or contract events,
[`parseEvents(events)`](https://jsr.io/@colibri/core/doc/~/parseEvents) returns
the SDK's human-readable representation (`null` when the array is omitted). That
helper does not create the ledger-aware callback stream shown above.
