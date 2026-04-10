# Signer

The Signer module defines `Signer`, the shared contract Colibri uses for
transaction signing, auth-entry signing, and detached signature workflows.

## Signer Interface

```ts
type Signer = {
  publicKey(): Ed25519PublicKey;
  sign(data: Uint8Array): Uint8Array;
  signTransaction(
    tx: SignableTransaction,
  ): Promise<TransactionXDRBase64> | TransactionXDRBase64;
  signSorobanAuthEntry(
    authEntry: SorobanAuthorizationEntryLike,
    validUntilLedgerSeq: number,
    networkPassphrase: string,
  ): Promise<SorobanAuthorizationEntryLike>;
  signsFor(target: Ed25519PublicKey | ContractId): boolean;
};
```

## Using Signers

Pass signers through `TransactionConfig`:

```ts
import {
  createInvokeContractPipeline,
  NetworkConfig,
} from "@colibri/core";

const networkConfig = NetworkConfig.TestNet();
const pipeline = createInvokeContractPipeline({ networkConfig });

const result = await pipeline.run({
  operations,
  config: {
    source: signer.publicKey(),
    fee: "100000",
    timeout: 30,
    signers: [signer],
  },
});
```

## Implementing Custom Signers

```ts
class CustomSigner implements Signer {
  publicKey(): Ed25519PublicKey {
    throw new Error("Implement me");
  }

  sign(data: Uint8Array): Uint8Array {
    throw new Error("Implement me");
  }

  signTransaction(tx: SignableTransaction): TransactionXDRBase64 {
    throw new Error("Implement me");
  }

  async signSorobanAuthEntry(
    authEntry: SorobanAuthorizationEntryLike,
    validUntilLedgerSeq: number,
    networkPassphrase: string,
  ): Promise<SorobanAuthorizationEntryLike> {
    throw new Error("Implement me");
  }

  signsFor(target: Ed25519PublicKey | ContractId): boolean {
    throw new Error("Implement me");
  }
}
```

## Available Signers

| Signer                         | Description                             |
| ------------------------------ | --------------------------------------- |
| [LocalSigner](local-signer.md) | In-memory signer for development/testing |

## Next Steps

- [LocalSigner](local-signer.md) — Built-in signer implementation
- [Transaction Config](../transaction-config.md) — Where signers are supplied
