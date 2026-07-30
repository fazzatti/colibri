# Invoke Contract Pipeline

`createInvokeContractPipeline(...)` is the main write pipeline for Soroban
contract interactions.

## Composition

This pipeline uses step wrappers around:

1. [BuildTransaction](../processes/build-transaction.md)
2. [SimulateTransaction](../processes/simulate-transaction.md) in recording
   mode
3. [SignAuthEntries](../processes/sign-auth-entries.md)
4. [AssembleForEnforcement](../processes/assemble-for-enforcement.md)
5. [EnforceSimulation](../processes/enforce-simulation.md)
6. [AssembleTransaction](../processes/assemble-transaction.md)
7. [EnvelopeSigningRequirements](../processes/envelope-signing-requirements.md)
8. [SignEnvelope](../processes/sign-envelope.md)
9. [SendTransaction](../processes/send-transaction.md)

The two enforcement processes inspect operation XDR directly. For ordinary
authorization entries they are pass-through steps and make no additional RPC
request. When signed entries contain delegated credentials, they assemble an
intermediate transaction and run the Protocol 27 enforcing simulation. Final
assembly uses the original base transaction and signed entries with resources
returned by that second simulation.

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
- CAP-71 delegated custom-account authorization
- flows where you want to attach plugins such as fee bump or channel accounts
- lower-level orchestration beneath `Contract.invoke(...)`
