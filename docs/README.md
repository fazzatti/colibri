# Introduction

{% hint style="info" %}
**Beta Software** — All packages are currently in beta (`0.x.x`). Public APIs
may still change between minor releases.
{% endhint %}

<figure><picture><source srcset=".gitbook/assets/colibri-logo-dark-sq.png" media="(prefers-color-scheme: dark)"><img src=".gitbook/assets/colibri-logo-light-sq.png" alt=""></picture><figcaption></figcaption></figure>

Colibri is a TypeScript-first toolkit for building Stellar and Soroban
applications. It combines high-level clients, reusable transaction pipelines,
low-level process functions, typed errors, and optional plugins so you can work
at the level of abstraction that fits your project.

## Why Colibri?

- **Layered API surface** — Start with high-level tools like `Contract` and
  `StellarAssetContract`, then drop down to pipelines, steps, or raw processes
  when you need more control.
- **Factory-style orchestration** — Built-in pipelines and plugins are created
  with `create*Pipeline(...)` and `create*Plugin(...)` factories, which keeps
  orchestration explicit and testable.
- **Plugin-friendly flows** — Attach behavior such as fee sponsorship or
  channel-account source swapping to specific pipeline targets without rewriting
  the transaction flow.
- **Typed error model** — Stable error codes and typed error classes make it
  easier to debug network, signing, simulation, and orchestration failures.
- **Event tooling** — Parse raw Soroban events and work with standardized SAC
  and SEP-41 event templates.
- **Deno + JSR ready** — Published on [JSR](https://jsr.io/) with Deno-native
  install and import flows.

## Packages

| Package                             | Description                                           | JSR                                                                                                             |
| ----------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **@colibri/core**                   | Core primitives, clients, processes, pipelines, tools | [![JSR](https://jsr.io/badges/@colibri/core)](https://jsr.io/@colibri/core)                                     |
| **@colibri/sep10**                  | SEP-10 Web Authentication client                      | [![JSR](https://jsr.io/badges/@colibri/sep10)](https://jsr.io/@colibri/sep10)                                   |
| **@colibri/rpc-streamer**           | Real-time and historical RPC streaming                | [![JSR](https://jsr.io/badges/@colibri/rpc-streamer)](https://jsr.io/@colibri/rpc-streamer)                     |
| **@colibri/test-tooling**           | Docker-backed integration test harnesses              | [![JSR](https://jsr.io/badges/@colibri/test-tooling)](https://jsr.io/@colibri/test-tooling)                     |
| **@colibri/plugin-fee-bump**        | Fee sponsorship plugin for transaction pipelines      | [![JSR](https://jsr.io/badges/@colibri/plugin-fee-bump)](https://jsr.io/@colibri/plugin-fee-bump)               |
| **@colibri/plugin-channel-accounts** | Sponsored channel-account pooling for write pipelines | [![JSR](https://jsr.io/badges/@colibri/plugin-channel-accounts)](https://jsr.io/@colibri/plugin-channel-accounts) |

## Quick Example

```ts
import { Contract, LocalSigner, NetworkConfig } from "@colibri/core";

const network = NetworkConfig.TestNet();
const signer = LocalSigner.fromSecret("S...");

const contract = new Contract({
  networkConfig: network,
  contractConfig: {
    contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  },
});

const result = await contract.invoke({
  method: "hello",
  methodArgs: { to: "World" },
  config: {
    source: signer.publicKey(),
    fee: "100000",
    timeout: 30,
    signers: [signer],
  },
});

console.log("Transaction successful:", result.hash);
console.log("Return value:", result.returnValue);
```

## Next Steps

- [Installation](getting-started/installation.md) — Add Colibri packages to
  your project
- [Quick Start](getting-started/quick-start.md) — Build your first contract
  interaction
- [Architecture Overview](getting-started/architecture.md) — Understand how
  processes, steps, pipelines, and plugins fit together

## Resources

- [GitHub Repository](https://github.com/fazzatti/colibri)
- [Examples Repository](https://github.com/fazzatti/colibri-examples)
- [Stellar Developer Docs](https://developers.stellar.org/)
