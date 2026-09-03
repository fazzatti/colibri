# Quick start: send a Testnet payment

This complete script creates two disposable signers, funds their accounts with
Friendbot, and sends one test XLM through Colibri's classic pipeline. It uses
Testnet only; do not replace the network with Mainnet while learning.

## Install and run

```sh
deno add jsr:@colibri/core npm:@stellar/stellar-sdk
# Save the script below as payment.ts.
deno run --allow-net payment.ts
```

<!-- deno-check -->

```ts
import {
  createClassicTransactionPipeline,
  initializeWithFriendbot,
  LocalSigner,
  NetworkConfig,
} from "@colibri/core";
import { Asset, Operation } from "npm:@stellar/stellar-sdk";

const network = NetworkConfig.TestNet();
const sender = LocalSigner.generateRandom();
const recipient = LocalSigner.generateRandom();

// A random key is only an identity until an account is created on the ledger.
for (const signer of [sender, recipient]) {
  await initializeWithFriendbot(network.friendbotUrl, signer.publicKey(), {
    rpcUrl: network.rpcUrl,
    allowHttp: network.allowHttp,
  });
}

const pipeline = createClassicTransactionPipeline({ networkConfig: network });
const result = await pipeline.run({
  operations: [Operation.payment({
    destination: recipient.publicKey(),
    asset: Asset.native(),
    amount: "1", // Classic payment amounts are decimal XLM, not stroops.
  })],
  config: {
    source: sender.publicKey(),
    signers: [sender],
    fee: "100", // Base fee in stroops, multiplied by operation count.
    timeout: 30,
  },
});
console.log("Confirmed transaction:", result.hash);
```

The pipeline loads the source sequence, builds the transaction, resolves
envelope requirements, signs, submits, and polls for confirmation. The result is
returned after a successful RPC transaction result. This classic flow has no
Soroban resource simulation or auth entries.

Friendbot may be rate-limited or temporarily unavailable. A failed setup is not
a payment failure. Never store production secrets in examples or logs; these
random keys are disposable and this script does not persist them.

## Where to go next

- [Call a contract](contract-call.md): load an ABI and use simulation or a
  write.
- [Transaction configuration](../core/transaction-config.md): fee units, caps,
  bounds, and signers.
- [Architecture](architecture.md): choose a client, pipeline, or process.
- [Handle errors](../core/error.md): interpret failures without parsing
  messages.
