# Event filters

`EventFilter` describes which events to accept: event type, contract IDs, and
alternative topic patterns. It also evaluates those constraints locally for
archive ingestion. It is not a subscription by itself.

## Build and encode a filter

This complete local example needs Core and the Stellar SDK; it does not make
network requests. Save it as `filter.ts` and run `deno run filter.ts`.

<!-- deno-check -->

```ts
import { EventFilter, EventType } from "@colibri/core";
import { xdr } from "npm:@stellar/stellar-sdk";

const filter = new EventFilter({
  type: EventType.Contract,
  topics: [[xdr.ScVal.scvSymbol("transfer"), "**"]],
});
console.log(filter.toRawEventFilter());
```

`toRawEventFilter()` encodes topic values as base64 XDR. Use that payload with
the SDK's event RPC, or pass the `EventFilter` directly to
[`RPCStreamer.event()`](../packages/rpc-streamer/events.md).

## Constraints and matching

| Property      | Meaning                                                          |
| ------------- | ---------------------------------------------------------------- |
| `type`        | `EventType.Contract` or `EventType.System`; omitted means either |
| `contractIds` | Up to five contract IDs; omitted/empty means any                 |
| `topics`      | Up to five alternative topic patterns; omitted/empty means any   |

A topic pattern contains at most four segments. Concrete segments are ScVals:
`scvSymbol("transfer")` and `scvString("transfer")` are different XDR values, so
use the type the contract actually emits.

- `"*"` matches one segment.
- `"**"` matches the remaining segments; place it last.
- Concrete values match their XDR encoding, not a stringified native value.

`matchesType()`, `matchesContractId()`, and `matchesTopics()` perform the local
checks. They do not prove the event belongs to a successful transaction or that
its contract implements a particular standard.

## Use a standard template

<!-- deno-check -->

```ts
import { EventFilter, EventType, SACEvents } from "@colibri/core";

const filter = new EventFilter({
  type: EventType.Contract,
  topics: [SACEvents.TransferEvent.toTopicFilter()],
});
console.log(filter.toRawEventFilter());
```

Add a validated contract ID when you only want one asset. Template
`toTopicFilter({ to: recipient })` can constrain named indexed fields. Data
values such as transfer amount are not indexed topics: filter them in your
handler after decoding.

See [event templates](templates.md), [SAC events](standardized-events/sac.md),
[SEP-41 events](standardized-events/sep-41.md), and
[filter errors](../reference/errors/core-event-event-filter.md).
