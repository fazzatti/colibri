# Introduction

{% hint style="info" %}
**Beta Software** — All packages are currently in beta (0.x.x). APIs may change between minor versions.
{% endhint %}

<figure><picture><source srcset=".gitbook/assets/colibri-logo-dark-sq.png" media="(prefers-color-scheme: dark)"><img src=".gitbook/assets/colibri-logo-light-sq.png" alt=""></picture><figcaption></figcaption></figure>

A TypeScript-first toolkit for building robust Stellar and Soroban applications. Built for the [Deno](https://deno.land/) runtime with first-class TypeScript support.

## Why Colibri?

* **Versatile & Approachable** — Ready-to-use tools that help newcomers to Stellar learn through curated, guided solutions while offering experienced developers the building blocks to create highly customized implementations
* **TypeScript-First** — Built from the ground up with TypeScript, providing full type safety, intelligent autocompletion, and compile-time guarantees. Published on [JSR](https://jsr.io/) for seamless Deno and TypeScript integration
* **Contract Client** — A robust client for interacting with Soroban contracts across their entire lifecycle—from deployment and initialization to invocation and state queries
* **Pipelines** — Pre-built pipelines chain curated processes for common use cases like contract invocation and classic transactions. Use them directly or customize them for specialized scenarios
* **Processes** — Atomic building blocks with predictable behavior and specific error codes. Each process handles one task reliably and can be composed into custom workflows
* **Plugins** — Extend pipeline and process behavior without modifying core logic. Add fee sponsorship, custom signing strategies, or your own middleware at any step
* **Standardized Errors** — Unique, typed error codes across the entire library. Network failures and external errors are wrapped and enriched with context, diagnostics, and actionable suggestions
* **Event Handling** — Ingest and handle Soroban contract events with ease using standardized schemas such as [SAC](https://developers.stellar.org/docs/tokens/stellar-asset-contract) and [SEP-41](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md) specifications, with full support to [CAP-67](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md) muxed account support
* **Utilities** — Helpers for common Stellar development tasks including TOID generation and parsing ([SEP-35](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0035.md)), StrKey validation([SEP-23](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md)), network configuration and more

## Packages

Colibri is organized into separate packages so projects can select only the tooling they need. The **core** package provides the central features and capabilities used across the ecosystem, while additional packages offer specialized solutions for specific use cases, environments, and needs.

| Package                      | Description                                     | JSR                                                                                               |
| ---------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **@colibri/core**            | Core primitives for Stellar/Soroban development | [![JSR](https://jsr.io/badges/@colibri/core)](https://jsr.io/@colibri/core)                       |
| **@colibri/event-streamer**  | Real-time and historical event ingestion        | [![JSR](https://jsr.io/badges/@colibri/event-streamer)](https://jsr.io/@colibri/event-streamer)   |
| **@colibri/plugin-fee-bump** | Fee bump plugin for sponsored transactions      | [![JSR](https://jsr.io/badges/@colibri/plugin-fee-bump)](https://jsr.io/@colibri/plugin-fee-bump) |

## Quick Example

```typescript
import { NetworkConfig, LocalSigner, Contract } from "@colibri/core";

// Configure network
const network = NetworkConfig.TestNet();

// Create a signer
const signer = LocalSigner.fromSecret("S...");

// Create a contract instance
const contract = Contract.create({
  networkConfig: network,
  contractConfig: {
    contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  },
});

// Invoke a contract method
const result = await contract.invoke({
  method: "hello",
  methodArgs: { to: "World" },
  config: {
    source: signer.publicKey(),
    signers: [signer],
  },
});

console.log("Transaction successful:", result.hash);
console.log("Return value:", result.returnValue);
```

## Getting Started

Ready to build? Head to the [Installation](getting-started/installation.md) guide to set up Colibri in your project.

## Resources

* [GitHub Repository](https://github.com/fazzatti/colibri)
* [Examples Repository](https://github.com/fazzatti/colibri-examples)
* [Stellar Developer Docs](https://developers.stellar.org/)
