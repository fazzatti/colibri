# Transaction Config

`TransactionConfig` is the standard type used across all Colibri pipelines to configure transaction parameters. It's a well-defined type that any calling code can construct directly, making it easy to integrate Colibri into your application.

```typescript
type TransactionConfig = {
  fee: BaseFee;
  source: Ed25519PublicKey;
  timeout: number;
  signers: TransactionSigner[];
};

type BaseFee = `${number}`;
```

## Properties

| Property  | Type                  | Description                                        |
| --------- | --------------------- | -------------------------------------------------- |
| `fee`     | `BaseFee`             | Base fee in stroops as a string (e.g., `"100000"`) |
| `source`  | `Ed25519PublicKey`    | Source account public key (G...)                   |
| `timeout` | `number`              | Transaction timeout in seconds                     |
| `signers` | `TransactionSigner[]` | Array of signers to sign the transaction           |

The `signers` array accepts any object implementing the [TransactionSigner](signer/README.md) interface, allowing you to integrate custom key management solutions.

## Usage

```typescript
import { PIPE_InvokeContract, LocalSigner, NetworkConfig } from "@colibri/core";
import { Operation } from "stellar-sdk";

const network = NetworkConfig.TestNet();
const signer = LocalSigner.fromSecret("S...");

const pipeline = PIPE_InvokeContract.create({ networkConfig: network });
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

## Next Steps

- [Signer](signer/README.md) — TransactionSigner interface
- [Pipelines](pipelines/README.md) — Use TransactionConfig in workflows
