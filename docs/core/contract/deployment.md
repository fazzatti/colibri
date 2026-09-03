# Deploy and load a specification

[Contract overview](../contract.md)

## Complete Testnet deployment

Supply a compiled `hello_world.wasm` for a contract without constructor
arguments. Install Core, then run `deno run --allow-read --allow-net deploy.ts`.
This example uses a disposable Friendbot-funded signer, uploads code, and
deploys an instance. Use the
[examples repository](https://github.com/fazzatti/colibri-examples) for contract
source/build walkthroughs; no built-in fixture is shipped with Core.

<!-- deno-check -->

```ts
import {
  Contract,
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";

const networkConfig = NetworkConfig.TestNet();
const signer = LocalSigner.generateRandom();
await initializeWithFriendbot(networkConfig.friendbotUrl, signer.publicKey(), {
  rpcUrl: networkConfig.rpcUrl,
});
const contract = new Contract({
  networkConfig,
  contractConfig: { wasm: await Deno.readFile("./hello_world.wasm") },
});
const config = {
  source: signer.publicKey(),
  signers: [signer],
  fee: "100000" as const,
  timeout: 30,
};
await contract.loadSpecFromWasm();
await contract.uploadWasm(config); // First confirmed ledger transaction.
await contract.deploy({ config }); // Second transaction creates the instance.
console.log("Deployed contract", contract.getContractId());
```

Each call gets the next source sequence through the pipeline. Do not run these
dependent transactions concurrently. If your contract requires constructor
arguments, supply its spec-defined names as shown below.

## Deployment Helpers

### `uploadWasm()`

Uploads local wasm and stores the resulting hash on the instance.

For a client created with `contractConfig: { wasm }`, call
`await contract.loadSpecFromWasm()` when you need named constructor arguments,
then `await contract.uploadWasm(config)`, then
`await contract.deploy({ config,
constructorArgs })`. Upload and deployment are
separate ledger transactions; fund the source and provide its signers. A client
configured with an already uploaded `wasmHash` or `externalRef` does not upload
another Wasm first.

`loadSpecFromWasm()` reads the bytes configured on this client; it does not
download code or install it on-chain. A missing spec produces a typed error.

### `deploy()`

Deploys a contract using the configured wasm hash or external reference:

```ts
await contract.deploy({
  config: {
    fee: "10000000",
    timeout: 30,
    source: signer.publicKey(),
    signers: [signer],
  },
  constructorArgs: {
    owner: adminAddress,
  },
});
```

### `loadSpecFromNetwork()`

Resolves the current network executable, downloads its Wasm, and loads its
contract spec. It accepts clients configured with a Wasm hash, contract ID, or
external reference. For a contract ID whose executable is an external reference,
Colibri follows the owner/tag mapping automatically.

```ts
const contract = new Contract({
  networkConfig,
  contractConfig: { contractId: "CINSTANCE..." },
});

await contract.loadSpecFromNetwork();
```

External-reference mappings are mutable. Calling `loadSpecFromNetwork()` again
performs a fresh ledger read and replaces the local Wasm and spec. Colibri does
not cache the resolved hash as if it were the contract's permanent executable.
