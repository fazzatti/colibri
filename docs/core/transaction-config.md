# Transaction Config

`TransactionConfig` is the standard write-transaction configuration used
across Colibri pipelines and high-level clients. Its generic signer parameter
defaults to the complete `Signer` interface, preserving the classic and
existing local-signer shape.

```ts
type TransactionConfig<
  TSigner extends TransactionSigner = Signer,
> = {
  fee: BaseFee;
  source: Ed25519PublicKey;
  timeout: number;
  signers: TSigner[];
};

type SorobanTransactionConfig = TransactionConfig<TransactionSigner>;
type BaseFee = `${number}`;
```

## Properties

| Property  | Type               | Description |
| --------- | ------------------ | ----------- |
| `fee`     | `BaseFee`          | Base fee in stroops as a string |
| `source`  | `Ed25519PublicKey` | Source account public key |
| `timeout` | `number`           | Transaction timeout in seconds |
| `signers` | `TSigner[]`        | Signers used by the selected transaction flow |

Classic transaction APIs keep the default `Signer[]` shape. Soroban
invocations use `SorobanTransactionConfig`, so one list can contain envelope
signers, authorization-entry signers such as `DelegatedSigner`, or signers that
support both capabilities.

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
- [DelegatedSigner](signer/delegated-signer.md) — CAP-71 signer topology
- [Pipelines](pipelines/README.md) — Write flows that accept `TransactionConfig`
