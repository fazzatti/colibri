# Parse events with a schema

Core's `Event` normalizes an RPC event into IDs, ledger/transaction context,
parsed topics/value, and retained ScVals. `EventTemplate` adds a schema and
named field access. It does not establish trust in the emitting contract.

## Standard event parsing

Inside a handler receiving a Core `Event`, use a known template:

```ts
const transfer = SACEvents.TransferEvent.tryFromEvent(event);
if (transfer) {
  console.log(transfer.from, transfer.to, transfer.amount);
}
```

`tryFromEvent` returns `undefined` for a mismatch. `is(event)` checks the
schema, and `fromEvent(event)` throws if it does not match. Use
`fromEventResponse` when starting with the underlying SDK's RPC event response
instead of a Core `Event`. The retained `scvalTopics` and `scvalValue` are
available for raw inspection.

## Define a custom event

This complete local declaration defines an event with a symbol name, one indexed
address, and an `i128` data value. It can be used with actual events from a
contract emitting that schema. Install Core and run `deno run schema.ts`.

<!-- deno-check -->

```ts
import { EventTemplate } from "@colibri/core";

const depositSchema = {
  name: "deposit",
  topics: [{ name: "owner", type: "address" }],
  value: { name: "amount", type: "i128" },
} as const;

class DepositEvent extends EventTemplate<typeof depositSchema> {
  static override schema = depositSchema;
  get owner() {
    return this.get("owner");
  }
  get amount() {
    return this.get("amount");
  }
}

console.log(DepositEvent.toTopicFilter());
```

`toTopicFilter()` can synthesize values for supported indexed types: address,
boolean, symbol, string, u32, i32, and bytes. The schema's supported data types
are broader than filter synthesis; do not assume every parsed type can be
encoded into a filter by that helper.

## Delivery is not authorization

Check the contract ID and successful-call context required by your application.
An arbitrary contract can emit a familiar event name. Schema matching only
describes the payload; it does not establish asset identity or ownership.
Historical event parsing uses ledger/result metadata, not a new execution.

See [event IDs and TOIDs](../core/toid.md),
[event error codes](../reference/errors/core-event.md), and
[streaming recovery](../packages/rpc-streamer/recovery.md).
