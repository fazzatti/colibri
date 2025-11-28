# LocalSigner

`LocalSigner` is a simple in-memory signer shipped with Colibri for convenience during development and testing. It is not intended for production use cases where more secure key management solutions are recommended.

{% hint style="info" %}
LocalSigner shields the secret key by not exposing it unnecessarily—the key exists only inside a secure closure and is never returned by any method.
{% endhint %}

## Creating a LocalSigner

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
```

## Usage with Pipelines

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
    signers: [signer],
  },
});
```

## Fee Bump Signing

When using fee bumps, use separate LocalSigner instances for the user and sponsor:

```typescript
import { PIPE_InvokeContract, LocalSigner, NetworkConfig } from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";

const network = NetworkConfig.TestNet();
const userSigner = LocalSigner.fromSecret("S_USER...");
const sponsorSigner = LocalSigner.fromSecret("S_SPONSOR...");

const pipeline = PIPE_InvokeContract.create({ networkConfig: network });

const feeBumpPlugin = PLG_FeeBump.create({
  networkConfig: network,
  feeBumpConfig: {
    source: sponsorSigner.publicKey(),
    fee: "1000000",
    signers: [sponsorSigner],
  },
});
pipeline.addPlugin(feeBumpPlugin, PLG_FeeBump.target);

const result = await pipeline.run({
  operations: [...],
  config: {
    source: userSigner.publicKey(),
    fee: "100000",
    signers: [userSigner],
  },
});
```

## Next Steps

- [Signer](README.md) — TransactionSigner interface for custom implementations
- [Pipelines](../pipelines/README.md) — Use signers in transaction workflows
