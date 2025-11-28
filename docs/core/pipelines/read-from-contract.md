# Read From Contract Pipeline

For read-only contract calls that don't modify state.

## Flow

```
Input → Build → Simulate → ExtractReturnValue
```

## Usage

```typescript
import { PIPE_ReadFromContract, NetworkConfig } from "@colibri/core";
import { Operation } from "stellar-sdk";

const network = NetworkConfig.TestNet();

const pipeline = PIPE_ReadFromContract.create({
  networkConfig: network,
});

const operation = Operation.invokeContractFunction({
  contract: "CABC...",
  function: "balance",
  args: [
    /* ScVal arguments */
  ],
});

const returnValue = await pipeline.run({
  operations: [operation],
});

console.log("Balance:", returnValue);
```

## When to Use

Use this pipeline when:

- Reading contract state (balances, metadata, etc.)
- No transaction submission is needed
- You only need the simulated return value
