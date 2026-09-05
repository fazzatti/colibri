# Stream transactions and operations

`RPCStreamer.transaction()` and `RPCStreamer.operation()` are additive variants:
event and ledger streaming continue unchanged. Both new variants read complete
ledgers through native RPC `getLedgers`, then emit records in transaction and
operation order. They work with the same live, archive, and automatic modes.

## Follow transactions

This complete example starts at the latest Testnet ledger and stops after its
first transaction callback. It needs network access but no signer or funded
account. See [configuration](configuration.md) for native `Server`, granular
URL, and archive connection alternatives.

<!-- deno-check -->

```ts
import { NetworkConfig } from "@colibri/core";
import { RPCStreamer } from "@colibri/rpc-streamer";

const transactions = RPCStreamer.transaction({
  networkConfig: NetworkConfig.TestNet(),
});

await transactions.start((item) => {
  console.log(item.transactionHash, item.transactionStatus);
  console.log(item.ledgerSequence, item.transactionIndex);
  console.log(item.transaction.resultCode, item.transaction.fee);
  transactions.stop();
});

console.log("Resume from ledger:", transactions.nextLedger);
```

Every transaction is included, successful or failed. `transaction` is the
existing Core ledger-parser transaction, retaining its result code, fee, and
operation access. Hashes are read from ledger transaction results, not
calculated using an assumed network passphrase.

## Handle native operations

`operation` is Stellar SDK's native discriminated record. Narrowing its `type`
reveals the corresponding fields. Native decimal amount units are preserved; the
older Core `parsedOperation.body` view remains available separately.

<!-- deno-check -->

```ts
import { NetworkConfig } from "@colibri/core";
import { RPCStreamer } from "@colibri/rpc-streamer";

const operations = RPCStreamer.operation({
  networkConfig: NetworkConfig.TestNet(),
});

await operations.start((item) => {
  if (item.transactionStatus !== "success") return;
  if (item.operation.type !== "payment") return;

  console.log({
    transaction: item.transactionHash,
    operationIndex: item.operationIndex,
    destination: item.operation.destination,
    amount: item.operation.amount, // For example "1.2500000", not stroops.
    asset: item.operation.asset.toString(),
  });
  operations.stop();
});
```

An operation from a failed transaction represents attempted intent, not a
committed payment or trade. Always check transaction status when ingesting
completed effects. For fee bumps, operation indexes identify the inner
transaction's operations. `parsedOperation` retains the Core parser object and
its parent transaction.

## Cancellation and durable checkpoints

The factories also have named exports: `createTransactionStreamer` and
`createOperationStreamer`. Start options and pacing retain the semantics
documented under [modes](modes.md) and [recovery](recovery.md).

- Callbacks are awaited in order. There is no parallel callback delivery.
- A ledger is acknowledged only after all its items have been delivered.
- Stopping halfway through a ledger leaves `nextLedger` pointing at that ledger.
  On resume, its earlier items are replayed. Make persisted side effects
  idempotent using the transaction hash and, for operations, the operation
  index.
- Stopping in the final callback still completes the ledger and awaits its
  checkpoint. Empty ledgers complete without item callbacks.
- Checkpoint failures stop ingestion. An explicit `onError` skip policy retains
  the existing behavior for other ingestion failures; skipping may lose data.
- Missing or malformed envelopes fail rather than silently omitting operations.

This is streaming, not an indexer or a market database. Filtering and
persistence belong to the consuming application. Consult the
[API reference](https://jsr.io/@colibri/rpc-streamer/doc) for record fields and
[error reference](../../reference/errors/rpc-streamer.md) for shared runtime
errors.
