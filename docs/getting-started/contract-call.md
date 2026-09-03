# Call a contract

Use this guide with a deployed Hello World contract exposing `hello(to: string)`
on Testnet, such as the contract in the
[Colibri examples](https://github.com/fazzatti/colibri-examples). Contract IDs
are network-specific, and Testnet resets can remove old deployments; this guide
does not assume an old shared deployment still exists.

```sh
deno add jsr:@colibri/core
CONTRACT_ID=YOUR_DEPLOYED_CONTRACT_ID deno run --allow-net --allow-env=CONTRACT_ID hello.ts
```

<!-- deno-check -->

```ts
import { Contract, NetworkConfig } from "@colibri/core";

const contractId = Deno.env.get("CONTRACT_ID");
if (!contractId) {
  throw new Error("Set CONTRACT_ID to your Testnet Hello World contract");
}
const contract = new Contract({
  networkConfig: NetworkConfig.TestNet(),
  contractConfig: { contractId },
});

// A method name and named arguments require the contract specification.
await contract.loadSpecFromNetwork();
const greeting = await contract.read({
  method: "hello",
  methodArgs: { to: "World" },
});
console.log(greeting);
```

`read()` simulates and decodes the result using the loaded spec. It does not
submit a transaction or persist changes. A successful read is not evidence that
a later write will succeed: state and authorization can differ.

## Submit a write

With the funded signer and network setup from the
[payment quick start](quick-start.md), replace the read with the following
fragment:

```ts
const result = await contract.invoke({
  method: "hello",
  methodArgs: { to: "World" },
  config: {
    source: sender.publicKey(),
    signers: [sender],
    fee: { max: "1000000" },
    timeout: 30,
  },
});
console.log(result.hash, result.returnValue);
```

The example cap is 1,000,000 stroops (0.1 XLM), not a guarantee of actual cost.
Assembly fails if the simulated resources leave insufficient inclusion fee.
Network conditions and the method's resources determine whether the cap works.
For real application writes, choose the cap intentionally.

Use `readRaw()`/`invokeRaw()` or the pipeline factories when you already have
encoded ScVal arguments. See
[contract configuration](../core/contract/configuration.md),
[deployment](../core/contract/deployment.md), and
[the invoke pipeline](../core/pipelines/invoke-contract.md).
