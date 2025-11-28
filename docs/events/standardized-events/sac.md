# SAC Events

The [Stellar Asset Contract (SAC)](https://developers.stellar.org/docs/tokens/stellar-asset-contract) is a built-in Soroban contract that wraps classic Stellar assets. When these wrapped assets are used in Soroban, the SAC emits standardized events.

## Specification

SAC events are defined in [CAP-46-06](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-06.md) and updated by [CAP-67](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md) for muxed account support.

## Key Difference from SEP-41

SAC events include the **SEP-11 asset string** as a topic:

```
Topics: ["transfer", from, to, "USDC:GABC..."]
Data: amount (i128)
```

This allows filtering events by asset across all SAC contracts.

## Event Types

| Event         | Export                         | Description          |
| ------------- | ------------------------------ | -------------------- |
| Transfer      | `SACEvents.TransferEvent`      | Token transfers      |
| Mint          | `SACEvents.MintEvent`          | Token minting        |
| Burn          | `SACEvents.BurnEvent`          | Token burning        |
| Clawback      | `SACEvents.ClawbackEvent`      | Admin clawback       |
| Approve       | `SACEvents.ApproveEvent`       | Allowance approval   |
| SetAdmin      | `SACEvents.SetAdminEvent`      | Admin change         |
| SetAuthorized | `SACEvents.SetAuthorizedEvent` | Authorization change |

## Import

```typescript
import { SACEvents } from "@colibri/core";
```

## Parsing Events

```typescript
if (SACEvents.TransferEvent.is(event)) {
  const transfer = SACEvents.TransferEvent.fromEvent(event);

  console.log(transfer.from); // sender address
  console.log(transfer.to); // recipient address
  console.log(transfer.amount); // bigint
  console.log(transfer.asset); // "USDC:GABC..." or "native"
}
```

## Creating Filters

```typescript
// All SAC transfers
SACEvents.TransferEvent.toTopicFilter();

// Transfers to a specific address
SACEvents.TransferEvent.toTopicFilter({ to: "GABC..." });

// Transfers from a specific address
SACEvents.TransferEvent.toTopicFilter({ from: "GDEF..." });
```

## CAP-67: Muxed Account Support

SAC events support [CAP-67](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md) muxed account data. When a transfer involves a muxed account, the event value is a map instead of a simple i128:

```typescript
const transfer = SACEvents.TransferEvent.fromEvent(event);

// Check for muxed data
if (transfer.hasMuxedId()) {
  console.log(transfer.toMuxedId); // bigint
}
```

## Example

```typescript
import { EventStreamer } from "@colibri/event-streamer";
import { EventFilter, EventType, SACEvents } from "@colibri/core";

const filter = new EventFilter({
  type: EventType.Contract,
  topics: [SACEvents.TransferEvent.toTopicFilter()],
});

const streamer = new EventStreamer({
  rpcUrl: "https://soroban-testnet.stellar.org",
  filters: [filter],
});

await streamer.start((event) => {
  if (SACEvents.TransferEvent.is(event)) {
    const transfer = SACEvents.TransferEvent.fromEvent(event);
    console.log(`${transfer.asset}: ${transfer.from} → ${transfer.to}`);
  }
});
```
