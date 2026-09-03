# Use a channel with fee sponsorship

This complete Testnet example creates one sponsored channel, uses its sequence
for a payment whose operation source remains the sponsor, and closes it. All
keys are disposable. The fee-bump source pays the outer fee.

```sh
deno add jsr:@colibri/core jsr:@colibri/plugin-channel-accounts jsr:@colibri/plugin-fee-bump npm:@stellar/stellar-sdk
deno run --allow-net channel-payment.ts
```

<!-- deno-check -->

```ts
import {
  createClassicTransactionPipeline,
  initializeWithFriendbot,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
  type TransactionConfig,
} from "@colibri/core";
import {
  ChannelAccounts,
  createChannelAccountsPlugin,
} from "@colibri/plugin-channel-accounts";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";
import { Asset, Operation } from "npm:@stellar/stellar-sdk";

const networkConfig = NetworkConfig.TestNet();
const sponsor = NativeAccount.fromMasterSigner(LocalSigner.generateRandom());
const recipient = LocalSigner.generateRandom();
for (const publicKey of [sponsor.address(), recipient.publicKey()]) {
  await initializeWithFriendbot(networkConfig.friendbotUrl, publicKey, {
    rpcUrl: networkConfig.rpcUrl,
  });
}
const config: TransactionConfig = {
  source: sponsor.address(),
  signers: [sponsor.signer()],
  fee: "100",
  timeout: 30,
};
const channels = await ChannelAccounts.open({
  numberOfChannels: 1,
  sponsor,
  networkConfig,
  config,
});

try {
  const pipeline = createClassicTransactionPipeline({ networkConfig });
  pipeline.use(createChannelAccountsPlugin({ channels }));
  pipeline.use(createFeeBumpPlugin({
    networkConfig,
    feeBumpConfig: {
      source: sponsor.address(),
      fee: "1000",
      signers: [sponsor.signer()],
    },
  }));
  const result = await pipeline.run({
    operations: [Operation.payment({
      source: sponsor.address(), // Asset sender, independent of transaction source.
      destination: recipient.publicKey(),
      asset: Asset.native(),
      amount: "1",
    })],
    config,
  });
  console.log("Confirmed fee-bump transaction", result.hash);
} finally {
  // No runs remain active. The funded sponsor pays for the merge transaction.
  await ChannelAccounts.close({ channels, sponsor, networkConfig, config });
}
```

The roles are explicit: channel for sequence, sponsor as operation source in
this example, and sponsor as outer fee payer. These can be different accounts in
your application. See [pooling and lifecycle](../channel-accounts.md).
