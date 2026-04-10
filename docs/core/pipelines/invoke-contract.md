# Invoke Contract Pipeline

`createInvokeContractPipeline(...)` is the main write pipeline for Soroban
contract interactions.

## Composition

This pipeline uses step wrappers around:

1. [BuildTransaction](../processes/build-transaction.md)
2. [SimulateTransaction](../processes/simulate-transaction.md)
3. [SignAuthEntries](../processes/sign-auth-entries.md)
4. [AssembleTransaction](../processes/assemble-transaction.md)
5. [EnvelopeSigningRequirements](../processes/envelope-signing-requirements.md)
6. [SignEnvelope](../processes/sign-envelope.md)
7. [SendTransaction](../processes/send-transaction.md)

## Creating The Pipeline

```ts
import { createInvokeContractPipeline, NetworkConfig } from "@colibri/core";

const network = NetworkConfig.TestNet();
const pipeline = createInvokeContractPipeline({ networkConfig: network });
```

## Running The Pipeline

```ts
import { LocalSigner } from "@colibri/core";
import { Operation } from "stellar-sdk";

const signer = LocalSigner.fromSecret("S...");

const result = await pipeline.run({
  operations: [
    Operation.invokeContractFunction({
      contract: "CABC...",
      function: "transfer",
      args: [],
    }),
  ],
  config: {
    source: signer.publicKey(),
    fee: "1000000",
    timeout: 30,
    signers: [signer],
  },
});

console.log(result.hash);
console.log(result.returnValue);
```

## Typical Use Cases

- state-changing contract methods
- flows where you want to attach plugins such as fee bump or channel accounts
- lower-level orchestration beneath `Contract.invoke(...)`
