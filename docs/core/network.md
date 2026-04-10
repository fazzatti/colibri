# Network

`NetworkConfig` is used consistently across Colibri clients, pipelines,
processes, plugins, and tooling.

## Built-In Configurations

### TestNet

```ts
import { NetworkConfig } from "@colibri/core";

const network = NetworkConfig.TestNet();

console.log(network.rpcUrl);
console.log(network.horizonUrl);
console.log(network.friendbotUrl);
console.log(network.networkPassphrase);
```

### MainNet

```ts
const network = NetworkConfig.MainNet();
console.log(network.rpcUrl);
console.log(network.horizonUrl);
```

### FutureNet

```ts
const network = NetworkConfig.FutureNet();
console.log(network.rpcUrl);
console.log(network.friendbotUrl);
```

## Custom Configuration

```ts
const network = NetworkConfig.TestNet({
  rpcUrl: "https://my-custom-rpc.example.com",
  horizonUrl: "https://my-horizon.example.com",
  archiveRpcUrl: "https://my-archive-rpc.example.com",
});
```

### Common Fields

| Field            | Type        | Description                            |
| ---------------- | ----------- | -------------------------------------- |
| `rpcUrl`         | `string?`   | Soroban RPC endpoint                   |
| `archiveRpcUrl`  | `string?`   | Archive RPC endpoint for older data    |
| `horizonUrl`     | `string?`   | Horizon endpoint                       |
| `friendbotUrl`   | `string?`   | Friendbot endpoint for test networks   |
| `allowHttp`      | `boolean?`  | Allow non-HTTPS endpoints              |
| `networkPassphrase` | `string` | Stellar network passphrase             |

## Network Providers

Provider helpers expose known public infrastructure:

```ts
import { NetworkProviders } from "@colibri/core";

const network = NetworkProviders.Lightsail.MainNet();
console.log(network.rpcUrl);
console.log(network.archiveRpcUrl);
```

## Using NetworkConfig In Pipelines

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
      function: "hello",
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

## Using NetworkConfig In Plugins

Both built-in plugins also consume `NetworkConfig`:

```ts
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";
import { createChannelAccountsPlugin } from "@colibri/plugin-channel-accounts";
```

## Next Steps

- [Pipelines](pipelines/README.md) — Use network config in write and read flows
- [Contract](contract.md) — High-level contract usage
- [Tools](tools/README.md) — Friendbot and related helpers
