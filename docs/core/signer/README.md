# Signer

The Signer module defines independent capabilities for transaction envelopes
and Soroban authorization entries. A Soroban configuration can mix signers that
implement either capability.

## Signer Capabilities

```ts
type EnvelopeSigner = {
  signerKey(): ExtraSignerKey;
  signTransaction(
    tx: SignableTransaction,
  ): Promise<TransactionXDRBase64> | TransactionXDRBase64;
  signsFor(target: Ed25519PublicKey | ContractId): boolean;
};

type PreAuthTransactionSigner = {
  signerKey(): PreAuthTx;
  authorizesTransaction(
    tx: SignableTransaction,
  ): Promise<boolean> | boolean;
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

type Signer =
  | EnvelopeSigner
  | PreAuthTransactionSigner
  | AuthEntrySigner;
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
only `AuthEntrySigner`. `HashXSigner` and `Ed25519SignedPayloadSigner`
implement `EnvelopeSigner`. `PreAuthorizedTransactionSigner` verifies a
transaction hash without adding a decorated signature.

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
`signEnvelope(...)` narrows with `isEnvelopeSigner(...)` and
`isPreAuthTransactionSigner(...)`. A signer implementing multiple capabilities
passes every applicable guard.

Every transaction authorizer exposes an exact `signerKey()`. Colibri uses that
identity to match transaction `extraSigners` and deduplicate a signer selected
through both an account requirement and an exact key requirement.

For each required account, selection is intentional:

- no matching target produces `SIGNER_NOT_FOUND`;
- one matching signer key is selected;
- multiple instances of one key produce `DUPLICATE_SIGNER_KEY`;
- multiple distinct keys produce `AMBIGUOUS_ACCOUNT_SIGNERS`.

Colibri does not select by array order or apply implicit signer precedence.
Weighted multi-signature policy remains an application-level concern.

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

| Signer | Description |
| --- | --- |
| [LocalSigner](local-signer.md) | In-memory Ed25519 envelope and authorization-entry signer |
| [HashXSigner](hash-x-signer.md) | Hash-X preimage envelope signer |
| [Ed25519SignedPayloadSigner](signed-payload-signer.md) | Ed25519 signature over a disclosed payload |
| [PreAuthorizedTransactionSigner](pre-authorized-transaction-signer.md) | Exact transaction-hash authorizer |
| [DelegatedSigner](delegated-signer.md) | Recursive CAP-71 authorization-entry signer |

## Next Steps

- [LocalSigner](local-signer.md) — Built-in signer implementation
- [HashXSigner](hash-x-signer.md) — Hash-X signer and preimage lifecycle
- [Ed25519SignedPayloadSigner](signed-payload-signer.md) — Signed payload flow
- [PreAuthorizedTransactionSigner](pre-authorized-transaction-signer.md) —
  Exact transaction authorization
- [DelegatedSigner](delegated-signer.md) — Recursive delegated authorization
- [Transaction Config](../transaction-config.md) — Where signers are supplied
