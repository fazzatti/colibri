# Quick Start

This guide walks through a first Soroban call using Colibri's high-level
`Contract` client, then shows the equivalent pipeline-level flow.

## Setup

```bash
deno add jsr:@colibri/core
```

## Your First Contract Call

```ts
import {
  Contract,
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";

const network = NetworkConfig.TestNet();
const signer = LocalSigner.generateRandom();

await initializeWithFriendbot(network.friendbotUrl, signer.publicKey(), {
  rpcUrl: network.rpcUrl,
  allowHttp: network.allowHttp,
});

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

console.log("Transaction hash:", result.hash);
console.log("Return value:", result.returnValue);
```

## Using Pipelines Directly

Use a pipeline directly when you want to attach plugins or orchestrate the flow
yourself:

```ts
import {
  createInvokeContractPipeline,
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { Operation, xdr } from "npm:@stellar/stellar-sdk";

const network = NetworkConfig.TestNet();
const signer = LocalSigner.generateRandom();

await initializeWithFriendbot(network.friendbotUrl, signer.publicKey(), {
  rpcUrl: network.rpcUrl,
  allowHttp: network.allowHttp,
});

const pipeline = createInvokeContractPipeline({
  networkConfig: network,
});

const operation = Operation.invokeContractFunction({
  contract: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  function: "hello",
  args: [xdr.ScVal.scvString("World")],
});

const result = await pipeline.run({
  operations: [operation],
  config: {
    source: signer.publicKey(),
    fee: "100000",
    timeout: 30,
    signers: [signer],
  },
});

console.log(result.hash);
```

## Reading Contract State

```ts
import { Contract, NetworkConfig } from "@colibri/core";

const contract = new Contract({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: {
    contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
  },
});

const count = await contract.read({
  method: "get_count",
  methodArgs: {},
});

console.log("Current count:", count);
```

## Adding A Plugin

Pipelines can be extended with plugins such as fee sponsorship:

```ts
import {
  createInvokeContractPipeline,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";

const network = NetworkConfig.TestNet();
const sponsor = LocalSigner.fromSecret("S_SPONSOR...");

const pipeline = createInvokeContractPipeline({ networkConfig: network });
pipeline.use(
  createFeeBumpPlugin({
    networkConfig: network,
    feeBumpConfig: {
      source: sponsor.publicKey(),
      fee: "1000000",
      signers: [sponsor],
    },
  }),
);
```

High-level clients also expose the owned pipes when you need this:

```ts
contract.invokePipe.use(plugin);
```

## Understanding Errors

Colibri uses typed errors that extend `ColibriError`.

```ts
import { ColibriError } from "@colibri/core";

try {
  await contract.invoke({
    method: "hello",
    methodArgs: { to: "World" },
    config,
  });
} catch (error) {
  if (error instanceof ColibriError) {
    console.error(error.code);
    console.error(error.message);
    console.error(error.details);
  }
}
```

## Next Steps

- [Architecture Overview](architecture.md) — Understand processes, steps,
  pipelines, and plugins
- [Contract](../core/contract.md) — High-level contract client details
- [Pipelines](../core/pipelines/README.md) — Built-in transaction workflows
- [Plugins](../packages/plugins/README.md) — Attach optional behavior to write
  flows
