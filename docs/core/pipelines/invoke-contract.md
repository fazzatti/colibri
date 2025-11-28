# Invoke Contract Pipeline

The most commonly used pipeline for Soroban contract interactions.

## Flow

```
Input → Build → Simulate → SignAuth → Assemble → SignEnvelope → Send
```

## Creating the Pipeline

```typescript
import { PIPE_InvokeContract, NetworkConfig } from "@colibri/core";

const network = NetworkConfig.TestNet();

const pipeline = PIPE_InvokeContract.create({
  networkConfig: network,
});
```

## Running the Pipeline

```typescript
import { LocalSigner } from "@colibri/core";
import { Operation } from "stellar-sdk";

const signer = LocalSigner.fromSecret("S...");

const result = await pipeline.run({
  operations: [
    Operation.invokeContractFunction({
      contract: "CABC...",
      function: "transfer",
      args: [
        /* ScVal arguments */
      ],
    }),
  ],
  config: {
    source: signer.publicKey(),
    fee: "1000000",
    timeout: 30,
    signers: [signer],
  },
});

console.log("TX Hash:", result.hash);
console.log("Return Value:", result.returnValue);
```

## Configuration

### TransactionConfig

```typescript
type TransactionConfig = {
  source: Ed25519PublicKey;
  fee: BaseFee;
  timeout?: number;
  signers: TransactionSigner[];
  memo?: Memo;
};
```

### Output

```typescript
type InvokeContractOutput = {
  hash: string;
  returnValue: xdr.ScVal | undefined;
  response: Api.GetSuccessfulTransactionResponse;
};
```

## Error Handling

```typescript
try {
  const result = await pipeline.run({...});
  console.log("Success:", result.hash);
} catch (error) {
  if (error instanceof ColibriError) {
    console.log("Error code:", error.code);
    console.log("Message:", error.message);
  }
}
```
