# Parse ledgers, transactions, and operations

`Ledger`, `Transaction`, and `Operation` are Core's inspection wrappers for RPC
ledger metadata. They are not the same classes as the Stellar SDK's transaction
builder and operation factory. Alias imports when you use both.

Install Core and the underlying SDK. Save this as `inspect-ledger.ts` and run
`deno run --allow-net inspect-ledger.ts`:

<!-- deno-check -->

```ts
import { Ledger, NetworkConfig } from "@colibri/core";
import { rpc } from "npm:@stellar/stellar-sdk";

const networkConfig = NetworkConfig.TestNet();
const server = new rpc.Server(networkConfig.rpcUrl);
const { latestLedger } = await server.getHealth();
const response = await server.getLedgers({
  startLedger: latestLedger,
  pagination: { limit: 1 },
});
const entry = response.ledgers[0];
if (entry) {
  const ledger = Ledger.fromEntry(entry, networkConfig);
  console.log(ledger.sequence, ledger.protocolVersion, ledger.closedAt);
  for (const transaction of ledger.transactions) {
    console.log(transaction.hash, transaction.successful, transaction.fee);
    if (transaction.hasEnvelope) {
      console.log(transaction.sourceAccount, transaction.operationCount);
      for (const operation of transaction.operations) {
        console.log(operation.type, operation.sourceAccount, operation.body);
      }
    }
  }
}
```

## Network context and correct transaction matching

The second argument accepts either Colibri's `NetworkConfig` or the exact
network passphrase string. Both paths use the same native SDK transaction hash.
The parser does not guess Mainnet/Testnet and does not request network data.

When you only have an RPC client, discover its network with
`const { passphrase } = await server.getNetwork()` and pass that value to
`Ledger.fromEntry(entry, passphrase)`. The RPC Streamer's built-in ledger,
transaction and operation variants handle this automatically.

Envelope order in a transaction set differs from execution-result order. Colibri
matches them by network-specific hash and retains execution-result order. A
wrong passphrase, missing envelope, duplicate hash or unmatched extra envelope
fails explicitly, rather than returning an envelope belonging to another result.

Calling `Ledger.fromEntry(entry)` remains useful for offline result-only reads:
hashes, statuses, charged fees and metadata remain available, but `hasEnvelope`
is false. Provide network context to access sources, sequence numbers and
operations. Native raw and SDK-decoded RPC responses are both accepted.

## Lazy views and missing envelopes

The wrapper lazily decodes XDR and memoizes derived fields. `ledger.header` and
`ledger.meta` retain low-level access. Transactions constructed only from result
metadata may not have an envelope; `hasEnvelope` tells you whether envelope-only
properties such as source, sequence, and operations are available. Accessing
those without an envelope throws a typed parser error.

`transaction.fee` reads `feeCharged` from the execution result as a `bigint`. It
is not the fee bid from the original envelope. Keep that distinction when
auditing [fee configuration](transaction-config.md).

`transaction.sourceAccount` is the source executing the transaction's
operations. For fee bumps this is the **inner transaction source**, not the
account paying the outer fee. `transaction.feeSource` exposes that fee payer
separately. Both preserve muxed addresses. An operation without an explicit
source inherits `transaction.sourceAccount`.

`transaction.toEnvelope()` returns a separate native SDK XDR envelope. This is
useful for independent hashing or decoding with `TransactionBuilder.fromXdr`;
use the correct network passphrase. Result-only transactions raise distinct
errors for unavailable native envelope or fee-source access.

`transaction.resultCode` preserves the Stellar XDR result name, including
`txFeeBumpInnerSuccess` and negative-result names such as `txBadAuth`.
`transaction.successful` is true for both `txSuccess` and
`txFeeBumpInnerSuccess`. Events extracted from ledger metadata use the same
success classification; a successful fee-bump transaction is not a failed event
source simply because it has an outer envelope.

Operation views expose a decoded `body`, fall back to the transaction source
when no operation source exists, and retain access to their parent transaction.
Executable descriptions can represent uploaded Wasm, Stellar Asset Contracts, or
external references. A reference describes an owner/tag; resolving its current
Wasm is a separate [ledger-entry lookup](ledger-entries/contracts.md).

The parser does not query RPC itself, submit transactions, or provide an event
subscription. Use [RPC Streamer](../packages/rpc-streamer/ledgers.md) for
repeated reads and [event tools](../events/overview.md) for event extraction.

See [parser errors](../reference/errors/core-ledger-parser.md) and the
[API reference](https://jsr.io/@colibri/core/doc/~/Ledger).
