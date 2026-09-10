# LocalSigner

`LocalSigner` is Colibri's in-memory signer implementation. It is convenient for
development, testing, CI, and local tooling.

{% hint style="info" %} `LocalSigner` keeps the secret key inside a closure and
does not expose it through public object properties. {% endhint %}

## Creating A LocalSigner

### From Secret Key

```ts
import { LocalSigner } from "@colibri/core";

const signer = LocalSigner.fromSecret("S...");
console.log(signer.publicKey());
```

### From a Stellar SDK Keypair

`LocalSigner.fromKeypair(keypair, hideSecret = false)` is a convenience for
applications that already hold a native Stellar SDK signing Keypair. Pass the
returned signer to `TransactionConfig.signers`; raw keypairs are not accepted
by the transaction configuration. Existing signer interfaces and pipelines are
unchanged.

The factory borrows the Keypair without extracting or copying its secret. The
adapter's default target is only its own public G-address. Add other targets
explicitly when you have the required on-chain authority and authorization
encoding; adding a target alone grants no authority.

`destroy()` and `Symbol.dispose` invalidate the adapter without modifying the
original Keypair. The caller retains responsibility for the original key's
lifecycle. In contrast, signers created by `fromSecret()` and `generateRandom()`
own their keys and retain best-effort zeroization on destruction.

As with `fromSecret()`, `hideSecret` defaults to `false`. Passing `true` prevents
access through the adapter's `secretKey()` method; it does not hide or modify the
original Keypair. The adapter's JSON representation contains only its public key.

This complete example runs offline after installing Core and Stellar SDK:

<!-- deno-check -->

```ts
import { LocalSigner } from "@colibri/core";
import { Keypair } from "npm:@stellar/stellar-sdk@^17.0.1";

const keypair = Keypair.random();
const signer = LocalSigner.fromKeypair(keypair, true);
const payload = new TextEncoder().encode("example");
const signature = signer.sign(payload);
console.log(signer.verifySignature(payload, signature));
signer.destroy(); // The adapter is unusable; the caller's Keypair remains usable.
```

A public-only Keypair fails at construction with `SIG_LOC_007`.
`SIG_LOC_008` wraps an unexpected adaptation failure without retaining the
supplied keypair in error metadata. `LocalSignerErrors` exports the error
constructors for `instanceof` checks. An adapter used after destruction produces
the existing LocalSigner lifecycle errors.

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
import { Operation } from "npm:@stellar/stellar-sdk";

const network = NetworkConfig.TestNet();
const signer = LocalSigner.fromSecret("S...");

const invokeContract = createInvokeContractPipeline({ networkConfig: network });

const result = await invokeContract({
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

Colibri resolves signers through `signsFor(target)`. By default, `LocalSigner`
signs for its own public key. If you also need it to sign for a contract id, add
that target explicitly:

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

const invokeWithSponsor = createInvokeContractPipeline({
  networkConfig: network,
});

invokeWithSponsor.use(
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
