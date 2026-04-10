# Transaction Config

`TransactionConfig` is the standard write-transaction configuration used across
Colibri pipelines and high-level clients.

```ts
type TransactionConfig = {
  fee: BaseFee;
  source: Ed25519PublicKey;
  timeout: number;
  signers: Signer[];
};

type BaseFee = `${number}`;
```

## Properties

| Property  | Type               | Description                                        |
| --------- | ------------------ | -------------------------------------------------- |
| `fee`     | `BaseFee`          | Base fee in stroops as a string                    |
| `source`  | `Ed25519PublicKey` | Source account public key                          |
| `timeout` | `number`           | Transaction timeout in seconds                     |
| `signers` | `Signer[]`         | Signers used for envelope and auth-entry signing   |

## Usage

```ts
import {
  createInvokeContractPipeline,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { Operation } from "stellar-sdk";

const network = NetworkConfig.TestNet();
const signer = LocalSigner.fromSecret("S...");

const pipeline = createInvokeContractPipeline({ networkConfig: network });

const result = await pipeline.run({
  operations: [
    Operation.invokeContractFunction({
      contract: "CABC...",
      function: "hello",
      args: [],
    }),
  ],
  config: {
    source: signer.publicKey(),
    fee: "100000",
    timeout: 30,
    signers: [signer],
  },
});
```

High-level clients use the same shape:

```ts
await contract.invoke({
  method: "transfer",
  methodArgs,
  config,
});
```

## Next Steps

- [Signer](signer/README.md) — Signer interface and implementations
- [Pipelines](pipelines/README.md) — Write flows that accept `TransactionConfig`
