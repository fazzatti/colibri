# Transaction Config

`TransactionConfig` is the standard write-transaction configuration used
across Colibri pipelines and high-level clients. The same shape supports
classic transactions, Soroban invocations, and delegated authorization.

```ts
type TransactionConfig = {
  fee: BaseFee;
  source: Ed25519PublicKey;
  timeout: number;
  signers: Signer[];
};

type Signer = EnvelopeSigner | AuthEntrySigner;
type BaseFee = `${number}`;
```

## Properties

| Property  | Type               | Description |
| --------- | ------------------ | ----------- |
| `fee`     | `BaseFee`          | Base fee in stroops as a string |
| `source`  | `Ed25519PublicKey` | Source account public key |
| `timeout` | `number`           | Transaction timeout in seconds |
| `signers` | `Signer[]`         | Signers used by the selected transaction flow |

One list can contain envelope signers, authorization-entry signers such as
`DelegatedSigner`, or signers that support both capabilities. The relevant
signing process narrows each value with `isEnvelopeSigner(...)` or
`isAuthEntrySigner(...)` before invoking the capability.

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
