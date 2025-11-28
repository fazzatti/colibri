# Signer

The Signer module provides utilities for signing Stellar transactions using Ed25519 keypairs.

## LocalSigner

Create signers for local transaction signing:

### From Secret Key

```typescript
import { LocalSigner } from "@colibri/core";

const signer = LocalSigner.fromSecret("SBCDEFGHIJKLMNOPQRSTUVWXYZ...");

console.log(signer.publicKey()); // "GABC..."
```

### Generate Random Keypair

```typescript
const signer = LocalSigner.generateRandom();

console.log(signer.publicKey()); // New random public key
// Note: Secret key is never exposed - it exists only inside a secure closure
```

## TransactionSigner Interface

Signers implement the `TransactionSigner` interface:

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

## Using Signers with Pipelines

Pass signers to pipelines for automatic transaction signing:

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
      function: "transfer",
      args: [...],
    }),
  ],
  config: {
    source: signer.publicKey(),
    fee: "100000",
    signers: [signer], // Signer handles both TX and auth signing
  },
});
```

## Key Types

### Ed25519PublicKey

Public keys start with `G` and are 56 characters:

```typescript
type Ed25519PublicKey = string & { __brand: "Ed25519PublicKey" };

// Example: "GABC...XYZ"
```

### Ed25519SecretKey

Secret keys start with `S` and are 56 characters:

```typescript
type Ed25519SecretKey = string & { __brand: "Ed25519SecretKey" };

// Example: "SABC...XYZ"
```

{% hint style="danger" %}
**Never expose secret keys!** Store them securely and never commit them to version control.
{% endhint %}

## Validating Keys

Use `StrKey` to validate key formats:

```typescript
import { StrKey } from "@colibri/core";

// Validate public key
if (StrKey.isEd25519PublicKey(input)) {
  // input is Ed25519PublicKey
}

// Validate secret key
if (StrKey.isEd25519SecretKey(input)) {
  // input is Ed25519SecretKey
}
```

## Multiple Signers

For multi-signature transactions, pass multiple signers to the pipeline:

```typescript
import { LocalSigner, PIPE_InvokeContract, NetworkConfig } from "@colibri/core";
import { Operation } from "stellar-sdk";

const network = NetworkConfig.TestNet();
const signer1 = LocalSigner.fromSecret("S1...");
const signer2 = LocalSigner.fromSecret("S2...");

const pipeline = PIPE_InvokeContract.create({ networkConfig: network });
const result = await pipeline.run({
  operations: [
    Operation.invokeContractFunction({
      contract: "CABC...",
      function: "multi_sig_action",
      args: [...],
    }),
  ],
  config: {
    source: signer1.publicKey(),
    fee: "100000",
    signers: [signer1, signer2], // Both signers will be used
  },
});
```

## Fee Bump Signing

When using fee bumps, you need a separate signer for the fee bump source:

```typescript
import { PIPE_InvokeContract, LocalSigner, NetworkConfig } from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";
import { Operation } from "stellar-sdk";

const network = NetworkConfig.TestNet();
const userSigner = LocalSigner.fromSecret("S_USER...");
const sponsorSigner = LocalSigner.fromSecret("S_SPONSOR...");

const pipeline = PIPE_InvokeContract.create({ networkConfig: network });

// Add fee bump plugin
const feeBumpPlugin = PLG_FeeBump.create({
  networkConfig: network,
  feeBumpConfig: {
    source: sponsorSigner.publicKey(),
    fee: "1000000",
    signers: [sponsorSigner], // Separate signer for fee bump
  },
});
pipeline.addPlugin(feeBumpPlugin, PLG_FeeBump.target);

const result = await pipeline.run({
  operations: [
    Operation.invokeContractFunction({
      contract: "CABC...",
      function: "action",
      args: [],
    }),
  ],
  config: {
    source: userSigner.publicKey(),
    fee: "100000",
    signers: [userSigner],
  },
});
```

## Security Best Practices

### 1. Environment Variables

```typescript
// ✅ Good - load from environment
const signer = LocalSigner.fromSecret(Deno.env.get("STELLAR_SECRET_KEY")!);

// ❌ Bad - hardcoded secret
const signer = LocalSigner.fromSecret("SABC...");
```

### 2. Key Derivation

For production, consider deriving keys from a seed phrase:

```typescript
import { Keypair } from "@stellar/stellar-sdk";

// Derive from mnemonic (use a proper BIP-39 library)
const keypair = Keypair.fromRawEd25519Seed(derivedSeed);
const signer = LocalSigner.fromSecret(keypair.secret());
```

### 3. Custom Signers

For hardware wallets or custom signing flows, implement the `TransactionSigner` interface:

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

## Next Steps

- [Pipelines](pipelines/README.md) — Use signers in transaction workflows
- [StrKeys](strkeys.md) — Validate and identify key types
- [Fee Bump Plugin](../packages/plugin-fee-bump.md) — Sponsor transaction fees
