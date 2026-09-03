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

Override endpoints in a preset without changing its network identity:

```ts
const network = NetworkConfig.TestNet({
  rpcUrl: "https://my-custom-rpc.example.com",
  horizonUrl: "https://my-horizon.example.com",
  archiveRpcUrl: "https://my-archive-rpc.example.com",
});
```

### Common Fields

For a standalone ledger, use `CustomNet` with its exact passphrase. This
complete local declaration does not contact the endpoint; it describes a default
standalone Quickstart network. Run it with `deno run network.ts` after
installing Core. Prefer the actual details returned by Test Tooling when ports
are dynamic.

<!-- deno-check -->

```ts
import { NetworkConfig } from "@colibri/core";

const network = NetworkConfig.CustomNet({
  networkPassphrase: "Standalone Network ; February 2017",
  rpcUrl: "http://localhost:8000/rpc",
  friendbotUrl: "http://localhost:8000/friendbot",
  allowHttp: true,
});
console.log(network.isCustomNet());
```

Optional URLs are absent until configured. Setters only fill a value that has
not already been set; construct a new configuration to replace a preset URL.
Network presets are configuration, not endpoint health checks or guarantees of
archive retention. Public provider availability, rate limits, and credentials
are controlled by the provider.

| Field               | Type       | Description                          |
| ------------------- | ---------- | ------------------------------------ |
| `rpcUrl`            | `string?`  | Soroban RPC endpoint                 |
| `archiveRpcUrl`     | `string?`  | Archive RPC endpoint for older data  |
| `horizonUrl`        | `string?`  | Horizon endpoint                     |
| `friendbotUrl`      | `string?`  | Friendbot endpoint for test networks |
| `allowHttp`         | `boolean?` | Allow non-HTTPS endpoints            |
| `networkPassphrase` | `string`   | Stellar network passphrase           |

## Network Providers

Provider helpers expose known public infrastructure:

<!-- deno-check -->

```ts
import { NetworkProviders } from "@colibri/core";

const network = NetworkProviders.Lightsail.MainNet();
console.log(network.rpcUrl);
console.log(network.archiveRpcUrl);

const ankrArchive = NetworkProviders.Ankr.MainNet();
```

## Using NetworkConfig In Pipelines

<!-- deno-check -->

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
