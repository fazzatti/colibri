# LocalSigner

`LocalSigner` is Colibri's in-memory signer implementation. It is convenient
for development, testing, CI, and local tooling.

{% hint style="info" %}
`LocalSigner` keeps the secret key inside a closure and does not expose it
through public object properties.
{% endhint %}

## Creating A LocalSigner

### From Secret Key

```ts
import { LocalSigner } from "@colibri/core";

const signer = LocalSigner.fromSecret("S...");
console.log(signer.publicKey());
```

### Generate Random

```ts
const signer = LocalSigner.generateRandom();
```

## Usage With Pipelines

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
      function: "transfer",
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

## Signing Targets

Colibri resolves signers through `signsFor(target)`. By default,
`LocalSigner` signs for its own public key. If you also need it to sign for a
contract id, add that target explicitly:

```ts
import type { ContractId } from "@colibri/core";
import { LocalSigner } from "@colibri/core";

const signer = LocalSigner.fromSecret("S...");
signer.addTarget("CABC..." as ContractId);
```

## Fee Bump Example

```ts
import {
  createInvokeContractPipeline,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";

const network = NetworkConfig.TestNet();
const userSigner = LocalSigner.fromSecret("S_USER...");
const sponsorSigner = LocalSigner.fromSecret("S_SPONSOR...");

const pipeline = createInvokeContractPipeline({ networkConfig: network });

pipeline.use(
  createFeeBumpPlugin({
    networkConfig: network,
    feeBumpConfig: {
      source: sponsorSigner.publicKey(),
      fee: "1000000",
      signers: [sponsorSigner],
    },
  }),
);
```

## Next Steps

- [Signer](README.md) — Shared signer contract
- [Transaction Config](../transaction-config.md) — Where signers are supplied
