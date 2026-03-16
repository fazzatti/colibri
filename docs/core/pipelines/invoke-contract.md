# Invoke Contract Pipeline

The most commonly used pipeline for Soroban contract interactions.

## Composition

This pipeline uses step wrappers around the following raw processes:

1. [buildTransaction](../processes/build-transaction.md) — Creates the transaction
2. [simulateTransaction](../processes/simulate-transaction.md) — Simulates to get resource estimates
3. [signAuthEntries](../processes/sign-auth-entries.md) — Signs Soroban authorization entries
4. [assembleTransaction](../processes/assemble-transaction.md) — Attaches simulation results
5. [envelopeSigningRequirements](../processes/envelope-signing-requirements.md) — Determines required signatures
6. [signEnvelope](../processes/sign-envelope.md) — Signs the transaction
7. [sendTransaction](../processes/send-transaction.md) — Submits and waits for confirmation

Shared and pipeline-specific connectors adapt the data between each step.

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
  signers: Signer[];
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
