# Standardized Events

Colibri ships with built-in support for Stellar ecosystem event standards. These standards define how token contracts emit events for common operations like transfers, mints, and burns.

## Why Standards Matter

By following established standards, different tokens emit events in the same format. This means:

- **Consistent parsing** — One parser works for all compliant tokens
- **Reliable filtering** — Topic filters work across contracts
- **Type safety** — Strong typing for event data

## Supported Standards

| Standard            | Spec                                                                                     | Description                                     |
| ------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [SAC](sac.md)       | [CAP-46-06](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-06.md) | Stellar Asset Contract (wrapped classic assets) |
| [SEP-41](sep-41.md) | [SEP-41](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md)  | Soroban Token Interface                         |

## SAC vs SEP-41

Both standards define the same event types (transfer, mint, burn, etc.), but with one key difference:

- **SAC events** include the SEP-11 asset string (e.g., `"USDC:GABC..."`) as a topic
- **SEP-41 events** do not include the asset string (you identify the token by contract ID)

SAC is used by Stellar's built-in contracts that wrap classic assets. SEP-41 is the interface that custom Soroban token contracts implement.

## Usage

```typescript
import { SACEvents, SEP41Events, EventFilter, EventType } from "@colibri/core";

// For classic assets (XLM, USDC, etc.)
const sacFilter = new EventFilter({
  type: EventType.Contract,
  topics: [SACEvents.TransferEvent.toTopicFilter()],
});

// For custom Soroban tokens
const sep41Filter = new EventFilter({
  contractIds: ["CABC..."], // specific token contract
  type: EventType.Contract,
  topics: [SEP41Events.TransferEvent.toTopicFilter()],
});
```
