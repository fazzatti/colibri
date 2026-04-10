# Events Overview

Colibri provides tools for filtering and parsing Soroban contract events.

## Event Structure

Soroban events consist of:

- **Contract ID** — Which contract emitted the event
- **Type** — `Contract` or `System`
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

See [Standardized Events](standardized-events/README.md) for details on using these parsers.
