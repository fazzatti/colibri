# RPC Streamer

`@colibri/rpc-streamer` turns repeated Stellar RPC reads into an awaited stream
of callbacks. Use it for indexing ledgers, processing contract events, or
building an application-specific ingestor. It does not provide a database,
exactly-once delivery, or an automatic retry policy.

```sh
deno add jsr:@colibri/rpc-streamer jsr:@colibri/core
```

## Choose a guide

- [Stream events](rpc-streamer/events.md): filters, decoded events, and a
  bounded first run.
- [Stream ledgers](rpc-streamer/ledgers.md): complete ledgers and their
  transactions.
- [Live, archive, and automatic modes](rpc-streamer/modes.md): retention and
  inclusive ranges.
- [Configuration](rpc-streamer/configuration.md): constructors, defaults, and
  tuning.
- [Progress and recovery](rpc-streamer/recovery.md): shutdown, checkpoints, and
  error behavior.
- [Custom streamers](rpc-streamer/custom.md): implement an ingestor without
  replacing the control loop.
- [Errors](../reference/errors/rpc-streamer.md): every declared `RPC_*` code.

`RPCStreamer.event()` and `createEventStreamer()` are equivalent factories;
`RPCStreamer.ledger()` and `createLedgerStreamer()` are the ledger equivalents.
Both return the generic `RPCStreamer<T>`, not a separate lifecycle API.

See the [generated API reference](https://jsr.io/@colibri/rpc-streamer/doc) for
exact signatures and the
[examples repository](https://github.com/fazzatti/colibri-examples) for complete
projects.
