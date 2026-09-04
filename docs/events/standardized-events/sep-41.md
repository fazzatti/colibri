# SEP-41 Token Events

[SEP-41](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md)
defines the standard token interface and event vocabulary for Soroban token
contracts. Colibri implements the current v0.5.1 event shapes while retaining
compatibility with the earlier scalar and vector representations.

## Specification

SEP-41 defines these contract methods:

- `allowance`, `approve`, and `balance`
- `transfer` and `transfer_from`
- `burn` and `burn_from`
- `decimals`, `name`, and `symbol`

It also defines `transfer`, `approve`, `burn`, `mint`, and `clawback` events.
Minting and clawback functions are intentionally **not** standardized because
administrative token designs can differ. The corresponding event formats remain
standardized when a contract exposes those capabilities.

## Key Difference from SAC

SEP-41 events do **not** include the asset string as a topic:

```
Topics: ["transfer", from, to]
Data: amount (i128) or a symbol-keyed map
```

You identify the token by its contract ID, not by an asset topic.

## Event Types

| Event    | Export                      | Description                     |
| -------- | --------------------------- | ------------------------------- |
| Transfer | `SEP41Events.TransferEvent` | Token transfers                 |
| Mint     | `SEP41Events.MintEvent`     | Implementation-defined minting  |
| Burn     | `SEP41Events.BurnEvent`     | Token burning                   |
| Clawback | `SEP41Events.ClawbackEvent` | Implementation-defined clawback |
| Approve  | `SEP41Events.ApproveEvent`  | Allowance approval              |

## Import

```typescript
import { SEP41Events } from "@colibri/core";
```

## Parsing Events

```typescript
if (SEP41Events.TransferEvent.is(event)) {
  const transfer = SEP41Events.TransferEvent.fromEvent(event);

  console.log(transfer.from); // sender address
  console.log(transfer.to); // recipient address
  console.log(transfer.amount); // bigint
}
```

## Compatible Data Representations

Every parser accepts the earlier event representation and the v0.5.1
symbol-keyed map representation:

| Event                 | Earlier representation        | Map fields                                       |
| --------------------- | ----------------------------- | ------------------------------------------------ |
| `transfer` and `mint` | `amount: i128`                | `amount`, optional `to_muxed_id`, and extensions |
| `burn` and `clawback` | `amount: i128`                | `amount` and extensions                          |
| `approve`             | `[amount, live_until_ledger]` | `amount`, `live_until_ledger`, and extensions    |

Unknown symbol-keyed fields are accepted and preserved under `extensions`.
Colibri continues to validate every standardized field. A map with a missing or
incorrectly typed `amount`, `live_until_ledger`, or `to_muxed_id` is not treated
as a matching SEP-41 event.

```ts
const transfer = SEP41Events.TransferEvent.fromEvent(event);

transfer.amount; // bigint
transfer.toMuxedId; // bigint | string | Uint8Array | undefined
transfer.extensions; // Readonly<Record<string, parsed ScVal>>
```

Extension values cannot be statically known from SEP-41. Applications that know
their contract's extension schema can validate it at runtime and receive a typed
result:

```ts
const extension = transfer.decodeExtensions((fields) => {
  if (typeof fields.reference !== "string") {
    throw new Error("Missing transfer reference");
  }
  return { reference: fields.reference };
});

extension.reference; // string
```

The decoder is application-provided and opt-in. A decoder failure is wrapped in
an occurrence-specific Colibri error such as
`TRANSFER_EXTENSION_DECODER_FAILED`; the event itself is still valid SEP-41
data.

## Creating Filters

```typescript
// All SEP-41 transfers from a specific contract
const filter = new EventFilter({
  contractIds: ["CABC..."], // your token contract
  type: EventType.Contract,
  topics: [SEP41Events.TransferEvent.toTopicFilter()],
});

// Filter by recipient
SEP41Events.TransferEvent.toTopicFilter({ to: "GABC..." });
```

## Example

```typescript
import { RPCStreamer } from "@colibri/rpc-streamer";
import { EventFilter, EventType, SEP41Events } from "@colibri/core";

const MY_TOKEN = "CABC..."; // your custom token contract

const filter = new EventFilter({
  contractIds: [MY_TOKEN],
  type: EventType.Contract,
  topics: [SEP41Events.TransferEvent.toTopicFilter()],
});

const streamer = RPCStreamer.event({
  rpcUrl: "https://soroban-testnet.stellar.org",
  filters: [filter],
});

await streamer.start((event) => {
  if (SEP41Events.TransferEvent.is(event)) {
    const transfer = SEP41Events.TransferEvent.fromEvent(event);
    console.log(`${transfer.from} → ${transfer.to}: ${transfer.amount}`);
  }
});
```

For invoking the standardized token functions, use the
[SEP-41 Token Contract client](../../core/asset/sep-41-token-contract.md).
