# Stream contract events

An event stream calls your handler for each matching `Event`. Install
`@colibri/rpc-streamer` and `@colibri/core`, then save this as `events.ts` and
run `deno run --allow-net events.ts`.

<!-- deno-check -->

```ts
import { EventFilter, EventType, NetworkConfig } from "@colibri/core";
import { RPCStreamer } from "@colibri/rpc-streamer";

const network = NetworkConfig.TestNet();
const streamer = RPCStreamer.event({
  rpcUrl: network.rpcUrl,
  filters: [new EventFilter({ type: EventType.Contract })],
});

// Use current health instead of a historical number outside retention.
const { latestLedger } = await streamer.rpc.getHealth();
await streamer.start(async (event) => {
  console.log(event.id, event.contractId, event.type);
}, { startLedger: latestLedger, stopLedger: latestLedger });
```

This processes one ledger and finishes. No output is valid: that ledger may
contain no matching contract events. Omit `stopLedger` for a continuing stream;
the promise resolves when streaming ends, not when it starts.

## Select events

Pass `contractIds` to narrow the contracts and `topics` to narrow their events.
Use a contract ID from the same network as the RPC endpoint. Topic values are
XDR values, not ordinary JavaScript strings; `"*"` and `"**"` are wildcards.

This fragment expects your application's deployed SAC `contractId`:

```ts
import { EventFilter, EventType, SACEvents } from "@colibri/core";

const transfers = new EventFilter({
  contractIds: [contractId],
  type: EventType.Contract,
  topics: [SACEvents.TransferEvent.toTopicFilter()],
});
```

Pass `filters: [transfers]` to the factory. Learn matching and conversion in
[Event filters](../../events/event-filter.md); use
[SAC](../../events/standardized-events/sac.md) or
[SEP-41](../../events/standardized-events/sep-41.md) templates for known
schemas.

## Processing and storage

The ingestor awaits your handler. Await database writes there if their
completion must control progress. Make processing idempotent using the event ID:
restarting or replaying a ledger can deliver an event again.

Historical event ingestion is not an unlimited `getEvents` call. The archive
variant reads archived ledger metadata and applies filters locally. Your archive
endpoint must support the required ledger RPC data. See [modes](modes.md) and
[recovery](recovery.md) before running an indexer.
