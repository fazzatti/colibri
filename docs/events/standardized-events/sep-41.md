# SEP-41 Token Events

[SEP-41](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md)
defines the standard token interface and event vocabulary for Soroban token
contracts. Colibri implements the current v0.5.2 event shapes while retaining
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

The required SEP-41 topic prefix does not contain an asset string:

```
Topics: ["transfer", from, to]
Data: amount (i128) or a symbol-keyed map
```

Use the emitting contract ID to identify the token. Additional topic segments
are accepted; this can overlap [SAC](sac.md) event shapes. A structural match
alone cannot classify the emitting contract as a custom token or SAC.

The event name must be an XDR Symbol and required addresses must use the Address
arm for an account or contract. Amounts must be i128 and approval expiry must be
u32. A numerically equal u64 amount or a String containing an address is
rejected. This applies to every matching and parsing entrypoint.

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

Every parser accepts the earlier event representation and the v0.5.2
symbol-keyed map representation:

| Event                 | Earlier representation        | Map fields                                       |
| --------------------- | ----------------------------- | ------------------------------------------------ |
| `transfer` and `mint` | `amount: i128`                | `amount`, optional `to_muxed_id`, and extensions |
| `burn` and `clawback` | `amount: i128`                | `amount` and extensions                          |
| `approve`             | `[amount, live_until_ledger]` | `amount`, `live_until_ledger`, and extensions    |

Unknown symbol-keyed fields are accepted and preserved under `extensions`.
Colibri continues to validate every standardized field. `to_muxed_id` may be
absent or void, u64, or a historical String/32-byte Bytes memo. Other integer
arms and byte lengths are rejected;
[ABI-declared SEP-57 events](../../core/contract/events.md#sparse-map-data-and-ambiguity)
retain their narrower `Option<u64>` rule. A map with a missing or incorrectly
typed `amount`, `live_until_ledger`, or `to_muxed_id` is not treated as a
matching SEP-41 event.

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
[`TRANSFER_EXTENSION_DECODER_FAILED`](../../reference/errors/core-event.md); the
event itself is still valid SEP-41 data.

## Creating Filters

SEP-41 filters end with `**` to match the same required prefix as local
decoding. [Generic templates](../templates.md) keep exact topic matching by
default; their optional `topicMatch: "prefix"` and `wireTypes: true` settings
are explicit. Events can exceed four topics. The
[RPC filter limit](../event-filter.md) is four constraints followed optionally
by `**`.

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
