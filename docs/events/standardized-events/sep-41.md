# SEP-41 Events

[SEP-41](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md) defines the standard token interface for Soroban smart contracts. Any contract implementing SEP-41 emits standardized events that Colibri can parse.

## Specification

SEP-41 is the Soroban Token Interface standard. It defines:

- Token functions (`transfer`, `mint`, `burn`, etc.)
- Event formats for each function
- Required metadata methods

## Key Difference from SAC

SEP-41 events do **not** include the asset string as a topic:

```
Topics: ["transfer", from, to]
Data: amount (i128)
```

You identify the token by its contract ID, not by an asset topic.

## Event Types

| Event    | Export                      | Description        |
| -------- | --------------------------- | ------------------ |
| Transfer | `SEP41Events.TransferEvent` | Token transfers    |
| Mint     | `SEP41Events.MintEvent`     | Token minting      |
| Burn     | `SEP41Events.BurnEvent`     | Token burning      |
| Clawback | `SEP41Events.ClawbackEvent` | Admin clawback     |
| Approve  | `SEP41Events.ApproveEvent`  | Allowance approval |

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
import { EventStreamer } from "@colibri/event-streamer";
import { EventFilter, EventType, SEP41Events } from "@colibri/core";

const MY_TOKEN = "CABC..."; // your custom token contract

const filter = new EventFilter({
  contractIds: [MY_TOKEN],
  type: EventType.Contract,
  topics: [SEP41Events.TransferEvent.toTopicFilter()],
});

const streamer = new EventStreamer({
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
