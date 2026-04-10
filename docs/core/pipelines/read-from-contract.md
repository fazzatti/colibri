# Read From Contract Pipeline

`createReadFromContractPipeline(...)` is the read-only pipeline for contract
calls that do not submit a transaction.

## Composition

This pipeline uses:

1. [BuildTransaction](../processes/build-transaction.md)
2. [SimulateTransaction](../processes/simulate-transaction.md)

The result is adapted through the shared `simulateToRetval` connector so the
pipeline returns the simulated contract value directly.

## Usage

```ts
import { createReadFromContractPipeline, NetworkConfig } from "@colibri/core";
import { Operation } from "stellar-sdk";

const network = NetworkConfig.TestNet();
const pipeline = createReadFromContractPipeline({ networkConfig: network });

const operation = Operation.invokeContractFunction({
  contract: "CABC...",
  function: "balance",
  args: [],
});

const returnValue = await pipeline.run({
  operations: [operation],
});

console.log(returnValue);
```

## Typical Use Cases

- reading balances, metadata, and configuration from Soroban contracts
- low-level read orchestration beneath `Contract.read(...)`
