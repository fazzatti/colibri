# Signer

The Signer module defines independent capabilities for transaction envelopes
and Soroban authorization entries. A Soroban configuration can mix signers that
implement either capability.

## Signer Capabilities

```ts
type EnvelopeSigner = {
  signTransaction(
    tx: SignableTransaction,
  ): Promise<TransactionXDRBase64> | TransactionXDRBase64;
  signsFor(target: Ed25519PublicKey | ContractId): boolean;
};

type AuthEntrySigner = {
  signSorobanAuthEntry(
    authEntry: SorobanAuthorizationEntryLike,
    validUntilLedgerSeq: number,
    networkPassphrase: string,
    forAddress?: Ed25519PublicKey | ContractId,
  ): Promise<SorobanAuthorizationEntryLike>;
  signsFor(target: Ed25519PublicKey | ContractId): boolean;
};

type Signer = EnvelopeSigner | AuthEntrySigner;
```

`KeypairSigner` is the complete Ed25519 interface for implementations that
support detached signatures, envelopes, and authorization entries:

```ts
type KeypairSigner = EnvelopeSigner & AuthEntrySigner & {
  publicKey(): Ed25519PublicKey;
  sign(data: Uint8Array): Uint8Array;
};
```

`LocalSigner` implements `KeypairSigner`, while `DelegatedSigner` implements
only `AuthEntrySigner`.

## Using Signers

Pass every signer through the same `TransactionConfig.signers` list:

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

The pipeline carries `Signer[]` unchanged until a process needs a capability.
`signAuthEntries(...)` narrows with `isAuthEntrySigner(...)`, while
`signEnvelope(...)` narrows with `isEnvelopeSigner(...)`. A signer implementing
both capabilities passes both guards.

## Implementing A Custom Authorization-Entry Signer

```ts
class CustomAuthEntrySigner implements AuthEntrySigner {
  async signSorobanAuthEntry(
    authEntry: SorobanAuthorizationEntryLike,
    validUntilLedgerSeq: number,
    networkPassphrase: string,
    forAddress?: Ed25519PublicKey | ContractId,
  ): Promise<SorobanAuthorizationEntryLike> {
    throw new Error("Implement me");
  }

  signsFor(target: Ed25519PublicKey | ContractId) {
    throw new Error("Implement me");
  }
}
```

The method receives and returns the entire authorization entry. This keeps
custom account policy inside the signer implementation. Colibri does not
attempt to interpret custom signature values; the enforcing simulation is the
authoritative validation.

## Available Signers

| Signer                                     | Description                                      |
| ------------------------------------------ | ------------------------------------------------ |
| [LocalSigner](local-signer.md)             | In-memory full signer for development and testing |
| [DelegatedSigner](delegated-signer.md)     | Recursive CAP-71 authorization-entry signer       |

## Next Steps

- [LocalSigner](local-signer.md) — Built-in signer implementation
- [DelegatedSigner](delegated-signer.md) — Recursive delegated authorization
- [Transaction Config](../transaction-config.md) — Where signers are supplied
