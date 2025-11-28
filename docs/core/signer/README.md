# Signer

The Signer module defines the `TransactionSigner` interface—the standard type structure used throughout Colibri for transaction and authorization signing.

By defining a clear interface, anyone can build custom signers and key handling tools that integrate seamlessly with Colibri's pipelines and processes.

## TransactionSigner Interface

All signers in Colibri implement the `TransactionSigner` interface:

```typescript
type TransactionSigner = {
  /** Returns the public key for this signer */
  publicKey(): Ed25519PublicKey;

  /** Signs arbitrary data and returns the signature as a Buffer */
  sign(data: Buffer): Buffer;

  /** Signs a transaction and returns its XDR string */
  signTransaction(
    tx: Transaction | FeeBumpTransaction
  ): Promise<TransactionXDRBase64> | TransactionXDRBase64;

  /** Signs a Soroban authorization entry */
  signSorobanAuthEntry(
    authEntry: xdr.SorobanAuthorizationEntry,
    validUntilLedgerSeq: number,
    networkPassphrase: string
  ): Promise<xdr.SorobanAuthorizationEntry>;
};
```

## Using Signers

Pass signers to pipelines via the `TransactionConfig`:

```typescript
import { PIPE_InvokeContract, NetworkConfig } from "@colibri/core";

const pipeline = PIPE_InvokeContract.create({ networkConfig });
const result = await pipeline.run({
  operations: [...],
  config: {
    source: signer.publicKey(),
    fee: "100000",
    signers: [signer], // Signer handles both TX and auth signing
  },
});
```

## Multiple Signers

For multi-signature transactions, pass multiple signers:

```typescript
config: {
  source: signer1.publicKey(),
  fee: "100000",
  signers: [signer1, signer2], // Both signers will be used
}
```

## Implementing Custom Signers

For hardware wallets, custodial services, or custom signing flows, implement the `TransactionSigner` interface:

```typescript
class CustomSigner implements TransactionSigner {
  publicKey(): Ed25519PublicKey {
    // Return the public key
  }

  sign(data: Buffer): Buffer {
    // Sign arbitrary data
  }

  signTransaction(tx: Transaction | FeeBumpTransaction): TransactionXDRBase64 {
    // Sign and return XDR
  }

  async signSorobanAuthEntry(
    entry: xdr.SorobanAuthorizationEntry,
    validUntil: number,
    passphrase: string
  ): Promise<xdr.SorobanAuthorizationEntry> {
    // Sign Soroban auth entry
  }
}
```

## Available Signers

| Signer                         | Description                             |
| ------------------------------ | --------------------------------------- |
| [LocalSigner](local-signer.md) | Simple in-memory signer for convenience |

## Next Steps

- [LocalSigner](local-signer.md) — Built-in in-memory signer
- [TransactionConfig](transaction-config.md) — Configuration that includes signers
- [Pipelines](../pipelines/README.md) — Use signers in transaction workflows
