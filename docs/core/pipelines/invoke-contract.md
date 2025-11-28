# Invoke Contract Pipeline

The most commonly used pipeline for Soroban contract interactions.

## Process Composition

This pipeline chains the following processes:

1. [P_BuildTransaction](../processes/build-transaction.md) — Creates the transaction
2. [P_SimulateTransaction](../processes/simulate-transaction.md) — Simulates to get resource estimates
3. [P_SignAuthEntries](../processes/sign-auth-entries.md) — Signs Soroban authorization entries
4. [P_AssembleTransaction](../processes/assemble-transaction.md) — Attaches simulation results
5. [P_EnvelopeSigningRequirements](../processes/envelope-signing-requirements.md) — Determines required signatures
6. [P_SignEnvelope](../processes/sign-envelope.md) — Signs the transaction
7. [P_SendTransaction](../processes/send-transaction.md) — Submits and waits for confirmation

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
