# Transaction Config

`TransactionConfig` is the standard type used across all Colibri pipelines to configure transaction parameters—fee, source account, timeout, and signers.

## Type Philosophy

Colibri uses consistent type interfaces throughout its core modules. `TransactionConfig` is a well-defined type that any calling code can construct, making it easy to integrate Colibri pipelines into your application without being tied to specific helper functions.

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

## Fee Bump Config

For fee bump operations, Colibri provides a related `FeeBumpConfig` type that omits the timeout (fee bumps inherit the inner transaction's timeout):

```typescript
type FeeBumpConfig = {
  fee: BaseFee;
  source: Ed25519PublicKey;
  signers: TransactionSigner[];
};
```

Used with the Fee Bump plugin:

```typescript
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";

const feeBumpPlugin = PLG_FeeBump.create({
  networkConfig: network,
  feeBumpConfig: {
    source: sponsorSigner.publicKey(),
    fee: "1000000",
    signers: [sponsorSigner],
  },
});
```

## Custom Signers

The `signers` array accepts any object implementing the `TransactionSigner` interface. This allows you to integrate custom key management solutions while using the same transaction config structure.

See [Signer](signer/README.md) for details on implementing custom signers.

## Next Steps

- [Signer](signer/README.md) — TransactionSigner interface
- [Pipelines](pipelines/README.md) — Use TransactionConfig in workflows
- [Fee Bump Plugin](../packages/plugin-fee-bump.md) — Sponsor transactions with FeeBumpConfig
