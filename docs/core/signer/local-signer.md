# LocalSigner

`LocalSigner` is an in-memory signer shipped with Colibri for development and testing. It is convenient, but it is not intended for production environments where stronger key custody is required.

{% hint style="info" %}
LocalSigner keeps the secret key inside a closure and does not expose it through the public API.
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
import { LocalSigner } from "@colibri/core";

const signer = LocalSigner.generateRandom();

console.log(signer.publicKey());
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
    timeout: 30,
    signers: [signer],
  },
});
```

## Signing Targets

Colibri selects signers via `signsFor(target)`. By default, `LocalSigner` signs for its own public key.

If you need the signer to authorize a contract id as well, add that target explicitly:

```typescript
import { LocalSigner } from "@colibri/core";
import type { ContractId } from "@colibri/core";

const signer = LocalSigner.fromSecret("S...");
signer.addTarget("CABC..." as ContractId);
```

## Fee Bump Signing

When using fee bumps, use separate signer instances for the user and sponsor:

```typescript
import { PIPE_InvokeContract, LocalSigner, NetworkConfig } from "@colibri/core";
import { PLG_FeeBump } from "@colibri/plugin-fee-bump";

const network = NetworkConfig.TestNet();
const userSigner = LocalSigner.fromSecret("S_USER...");
const sponsorSigner = LocalSigner.fromSecret("S_SPONSOR...");

const pipeline = PIPE_InvokeContract.create({ networkConfig: network });

pipeline.use(
  PLG_FeeBump.create({
    networkConfig: network,
    feeBumpConfig: {
      source: sponsorSigner.publicKey(),
      fee: "1000000",
      signers: [sponsorSigner],
    },
  }),
);

const result = await pipeline.run({
  operations: [...],
  config: {
    source: userSigner.publicKey(),
    fee: "100000",
    timeout: 30,
    signers: [userSigner],
  },
});
```

## Next Steps

- [Signer](README.md) — Signer interface for custom implementations
- [Pipelines](../pipelines/README.md) — Use signers in transaction workflows
