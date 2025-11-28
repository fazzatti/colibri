# Network

`NetworkConfig` is used consistently across all Colibri tools—pipelines, processes, plugins, and utilities. Use the built-in configurations for common networks or define your own with full compatibility.

```typescript
type NetworkConfig = {
  rpcUrl: string;
  networkPassphrase: string;
  type: NetworkType;
  archiveRpcUrl?: string;
  horizonUrl?: string;
  friendbotUrl?: string;
  allowHttp?: boolean;
};
```

## Built-in Configurations

Create network configurations for TestNet, MainNet, or FutureNet:

### TestNet

```typescript
import { NetworkConfig } from "@colibri/core";

const network = NetworkConfig.TestNet();

console.log(network.rpcUrl); // "https://soroban-testnet.stellar.org:443"
console.log(network.horizonUrl); // "https://horizon-testnet.stellar.org"
console.log(network.friendbotUrl); // "https://friendbot.stellar.org"
console.log(network.networkPassphrase); // "Test SDF Network ; September 2015"
```

### MainNet

```typescript
const network = NetworkConfig.MainNet();

console.log(network.rpcUrl); // "https://mainnet.sorobanrpc.com"
console.log(network.horizonUrl); // "https://horizon.stellar.org"
console.log(network.friendbotUrl); // undefined (no friendbot on mainnet)
```

### FutureNet

```typescript
const network = NetworkConfig.FutureNet();

console.log(network.rpcUrl); // "https://rpc-futurenet.stellar.org:443"
console.log(network.friendbotUrl); // "https://friendbot-futurenet.stellar.org"
```

## Custom Configuration

Override default URLs when needed:

```typescript
const network = NetworkConfig.TestNet({
  rpcUrl: "https://my-custom-rpc.example.com",
  horizonUrl: "https://my-horizon.example.com",
  archiveRpcUrl: "https://my-archive-rpc.example.com",
});
```

### Configuration Options

| Option          | Type       | Description                            |
| --------------- | ---------- | -------------------------------------- |
| `rpcUrl`        | `string`   | Soroban RPC endpoint                   |
| `archiveRpcUrl` | `string?`  | Archive RPC for historical data        |
| `horizonUrl`    | `string?`  | Horizon API endpoint                   |
| `friendbotUrl`  | `string?`  | Friendbot URL (TestNet/FutureNet only) |
| `allowHttp`     | `boolean?` | Allow non-HTTPS connections            |

## Network Providers

Pre-configured setups for known infrastructure providers in the Stellar ecosystem with public infrastructure:

```typescript
import { NetworkProviders } from "@colibri/core";

// Use a provider's MainNet configuration
const network = NetworkProviders.Lightsail.MainNet();

console.log(network.rpcUrl);
console.log(network.archiveRpcUrl); // Some providers include archive RPC
```

Colibri's CI pipeline checks that all listed provider servers are up and healthy before publishing new package versions, ensuring an up-to-date and reliable list.

## Archive RPC

Archive RPC endpoints provide access to historical data beyond the standard RPC retention window (\~17 days). Required for:

* Historical event ingestion
* Past ledger queries
* Transaction history lookups

### Checking Archive Availability

```typescript
const network = NetworkProviders.Lightsail.MainNet();

if (network.archiveRpcUrl) {
  console.log("Archive RPC available");
} else {
  console.log("Only recent data available");
}
```

## Network Types

```typescript
enum NetworkType {
  MAINNET = "mainnet",
  TESTNET = "testnet",
  FUTURENET = "futurenet",
  CUSTOM = "custom",
}
```

### Checking Network Type

```typescript
const network = NetworkConfig.MainNet();

if (network.type === NetworkType.MAINNET) {
  console.log("Using MainNet - be careful!");
}
```

## Network Passphrases

Each network has a unique passphrase used for transaction signing:

```typescript
enum NetworkPassphrase {
  MAINNET = "Public Global Stellar Network ; September 2015",
  TESTNET = "Test SDF Network ; September 2015",
  FUTURENET = "Test SDF Future Network ; October 2022",
}
```

Access via config:

```typescript
const network = NetworkConfig.MainNet();
console.log(network.networkPassphrase);
// "Public Global Stellar Network ; September 2015"
```

## Example of Usage with Pipelines

All pipelines accept a `NetworkConfig`:

```typescript
import { PIPE_InvokeContract, NetworkConfig, LocalSigner } from "@colibri/core";
import { Operation } from "stellar-sdk";

const network = NetworkConfig.TestNet();
const signer = LocalSigner.fromSecret("S...");

const pipeline = PIPE_InvokeContract.create({ networkConfig: network });
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
    signers: [signer],
  },
});
```

## Next Steps

* [Pipelines](pipelines/) — Use network config in transactions
* [Event Streamer](../packages/event-streamer.md) — Stream events from the network
* [Tools](tools/) — Use Friendbot for TestNet funding
