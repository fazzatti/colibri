# Stream ledgers

Choose ledger streaming to inspect the transactions and operations in a ledger,
rather than only matching events. The handler receives Core's lazy `Ledger`.

Install the packages from the [overview](../rpc-streamer.md), save this as
`ledgers.ts`, and run `deno run --allow-net ledgers.ts`.

<!-- deno-check -->

```ts
import { NetworkConfig } from "@colibri/core";
import { RPCStreamer } from "@colibri/rpc-streamer";

const streamer = RPCStreamer.ledger({
  rpcUrl: NetworkConfig.TestNet().rpcUrl,
});
const { latestLedger } = await streamer.rpc.getHealth();
await streamer.startLive(async (ledger) => {
  console.log(`Ledger ${ledger.sequence}: ${ledger.hash}`);
  console.log(`${ledger.transactions.length} transactions`);
}, { startLedger: latestLedger, stopLedger: latestLedger });
```

This is a bounded read; it does not submit a transaction. The built-in ledger
ingestors fetch one ledger per request. Increasing `limit` does not turn the
ledger variant into a batch ingestor.

## Parsing only what you need

Core defers decoding until a property needs it and memoizes parsed results. You
do not have to parse every operation just to display a ledger sequence. See the
[ledger parser](../../core/ledger-parser.md) for deeper inspection.

## Long-lived consumers

Omit `stopLedger` to continue. Store your own last successfully processed ledger
after awaited application work. `stop()` requests a stop but does not abort an
in-flight RPC request. Await the streaming promise before shutting down
resources used by your callback. See [progress and recovery](recovery.md).
