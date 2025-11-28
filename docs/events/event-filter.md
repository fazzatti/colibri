# Event Filter

The `EventFilter` class is used to specify which Soroban events to capture.

## Creating Filters

```typescript
import { EventFilter, EventType } from "@colibri/core";

const filter = new EventFilter({
  contractIds: ["CABC...", "CDEF..."], // Contract IDs to monitor
  type: EventType.Contract, // Event type
  topics: [topicFilter], // Topic filters
});
```

## Constructor Options

### `contractIds`

Array of contract IDs to monitor:

```typescript
const filter = new EventFilter({
  contractIds: [
    "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA", // XLM
    "CB23WRDQWGSP6YPMY4UV5C4OW5CBTXKYN3XEATG7KJEZCXMJBYEHOUOV", // KALE
  ],
  type: EventType.Contract,
  topics: [...],
});
```

### `type`

The event type to filter:

```typescript
enum EventType {
  Contract = "contract", // User-defined contract events
  System = "system", // System-level events (e.g., SAC events)
}
```

Most events you'll work with are `Contract` events.

### `topics`

Topic filters control which events match based on topic values. See [Topic Filters](#topic-filters) below.

## Topic Filters

Soroban events have up to 4 topics (indexed values). Topic filters let you match specific values or wildcards.

### Structure

```typescript
type TopicFilter = (xdr.ScVal | "*" | "**")[];
```

### Exact Matching

Match specific topic values:

```typescript
import { xdr } from "@stellar/stellar-sdk";

const topics = [
  xdr.ScVal.scvSymbol("transfer"),  // Topic 0 must be "transfer"
  xdr.ScVal.scvAddress(...),        // Topic 1 must be this address
];
```

### Single Wildcard (`*`)

Match any single topic value:

```typescript
const topics = [
  xdr.ScVal.scvSymbol("transfer"), // Topic 0: exact
  "*", // Topic 1: any value
  "*", // Topic 2: any value
];
```

### Multi-Wildcard (`**`)

Match any remaining topics (must be last):

```typescript
const topics = [
  xdr.ScVal.scvSymbol("transfer"), // Topic 0: exact
  "**", // Topics 1-3: any values
];
```

## Using Event Templates

The easiest way to create topic filters is using event templates:

```typescript
import { SACEvents } from "@colibri/core";

// Filter for all transfer events
const transferFilter = SACEvents.TransferEvent.toTopicFilter();

// Filter for transfers to a specific address
const toAliceFilter = SACEvents.TransferEvent.toTopicFilter({
  to: "GALICE...",
});

// Filter for transfers from a specific address
const fromBobFilter = SACEvents.TransferEvent.toTopicFilter({
  from: "GBOB...",
});

// Filter for transfers between specific addresses
const specificFilter = SACEvents.TransferEvent.toTopicFilter({
  from: "GBOB...",
  to: "GALICE...",
});
```

## Multiple Filters

You can use multiple filters to capture different event types:

```typescript
import { EventStreamer } from "@colibri/event-streamer";
import { EventFilter, SACEvents } from "@colibri/core";

const transferFilter = new EventFilter({
  contractIds: ["C..."],
  type: EventType.Contract,
  topics: [SACEvents.TransferEvent.toTopicFilter()],
});

const mintFilter = new EventFilter({
  contractIds: ["C..."],
  type: EventType.Contract,
  topics: [SACEvents.MintEvent.toTopicFilter()],
});

const streamer = new EventStreamer({
  rpcUrl: "...",
  filters: [transferFilter, mintFilter], // Both filters
});
```

## Filter Examples

### All SAC Events from XLM Contract

```typescript
const xlmContract = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

// Transfer events
const transferFilter = new EventFilter({
  contractIds: [xlmContract],
  type: EventType.Contract,
  topics: [SACEvents.TransferEvent.toTopicFilter()],
});

// Mint events
const mintFilter = new EventFilter({
  contractIds: [xlmContract],
  type: EventType.Contract,
  topics: [SACEvents.MintEvent.toTopicFilter()],
});

// Burn events
const burnFilter = new EventFilter({
  contractIds: [xlmContract],
  type: EventType.Contract,
  topics: [SACEvents.BurnEvent.toTopicFilter()],
});
```

### Transfers to Specific Address

```typescript
const myAddress = "GABC...";

const incomingTransfers = new EventFilter({
  contractIds: ["C..."], // Token contract
  type: EventType.Contract,
  topics: [SACEvents.TransferEvent.toTopicFilter({ to: myAddress })],
});
```

### Custom Event Topics

For custom contract events:

```typescript
import { xdr } from "@stellar/stellar-sdk";

// Custom "deposit" event with user address topic
const customFilter = new EventFilter({
  contractIds: ["C..."],
  type: EventType.Contract,
  topics: [
    [
      xdr.ScVal.scvSymbol("deposit"), // Event name
      "**", // Any other topics
    ],
  ],
});
```

## Filter Conversion

Filters are converted to RPC format when passed to the Event Streamer:

```typescript
// EventFilter provides methods for conversion
const rpcFilter = filter.toRpcFilter();
```

## Best Practices

### 1. Be Specific

More specific filters reduce unnecessary event processing:

```typescript
// ❌ Too broad - gets all events from contract
const broad = new EventFilter({
  contractIds: ["C..."],
  type: EventType.Contract,
  topics: [["**"]],
});

// ✅ Specific - only transfer events
const specific = new EventFilter({
  contractIds: ["C..."],
  type: EventType.Contract,
  topics: [SACEvents.TransferEvent.toTopicFilter()],
});
```

### 2. Use Multiple Filters

Separate filters for different event types:

```typescript
// ✅ Separate filters for different events
const filters = [
  new EventFilter({...transfer topics...}),
  new EventFilter({...mint topics...}),
];
```

### 3. Validate Contract IDs

Ensure contract IDs are valid:

```typescript
import { StrKey } from "@colibri/core";

const contractId = "C...";
if (StrKey.isContractId(contractId)) {
  const filter = new EventFilter({
    contractIds: [contractId],
    // ...
  });
}
```

## Next Steps

- [SAC Events](standardized-events/sac.md) — Stellar Asset Contract event templates
- [SEP-41 Events](standardized-events/sep-41.md) — Token interface event templates
- [Event Streamer](../packages/event-streamer.md) — Use filters with streaming
