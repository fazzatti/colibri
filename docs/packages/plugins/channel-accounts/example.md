# Use a channel with fee sponsorship

This complete Testnet example creates one sponsored channel, uses its sequence
for a payment whose operation source remains the sponsor, and closes it. All
keys are disposable. The [fee-bump source](../fee-bump.md#configuration) pays
the outer fee. The inner payment uses
[TransactionConfig](../../../core/transaction-config.md);
[reserve sponsorship](../../../core/sponsorship.md) covers the channel account’s
reserve.

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
  createChannelAccountsConcurrent,
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
  pipeline.use(createFeeBumpPlugin({
    networkConfig,
    feeBumpConfig: {
      source: sponsor.address(),
      fee: "1000",
      signers: [sponsor.signer()],
    },
  }));
  const sendPayment = createChannelAccountsConcurrent({
    channels,
    run: pipeline,
  });
  const result = await sendPayment({
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

## Run with workers

This separate Deno example uses existing **funded Testnet** channel accounts. It
sets each channel's home domain and returns plain transaction receipts. Save it
as `channel-worker.ts`; its `import.meta.main` guard makes the same module safe
for import inside workers. Configure `CHANNEL_ACCOUNTS` as comma-separated
public addresses and one `CHANNEL_SECRET_<public-address>` environment variable
per account. Supply keys through your environment/secret provider, never source
control. No live [signer](../../../core/signer/README.md) crosses a worker
message.

Install the same Core/channel packages as above, then run:

```sh
deno run --allow-read --allow-net --allow-env channel-worker.ts
```

The [network configuration](../../../core/network.md) is explicitly Testnet.
[Operation sources](../channel-accounts.md#preserve-the-operation-source) and
[transaction config](../../../core/transaction-config.md) both use the assigned
channel here; these accounts pay their own fees. For sponsored zero-balance
accounts, create a worker-local [fee-bump plugin](../fee-bump.md) with its own
signing provider.

<!-- deno-check -->

```ts
import {
  createClassicTransactionPipeline,
  LocalSigner,
  NativeAccount,
  NetworkConfig,
} from "@colibri/core";
import {
  createChannelAccountsParallel,
  createChannelAccountsPlugin,
  createChannelAccountsWorker,
} from "@colibri/plugin-channel-accounts";
import { Operation } from "npm:@stellar/stellar-sdk";

const definition = createChannelAccountsWorker(async (address) => {
  const secret = Deno.env.get(`CHANNEL_SECRET_${address}`);
  if (!secret) throw new Error("Missing worker-local channel key");
  const channel = NativeAccount.fromMasterSigner(
    LocalSigner.fromSecret(secret as `S${string}`),
  );
  const pipeline = createClassicTransactionPipeline({
    networkConfig: NetworkConfig.TestNet(),
  });
  pipeline.use(createChannelAccountsPlugin({ channels: [channel] }));
  return {
    channel,
    async run(homeDomain: string) {
      const result = await pipeline({
        operations: [Operation.setOptions({
          source: channel.address(),
          homeDomain,
        })],
        config: {
          source: channel.address(),
          signers: [channel.signer()],
          fee: "100",
          timeout: 30,
        },
      });
      return { channel: channel.address(), hash: result.hash };
    },
  };
}, { module: import.meta.url });

export default definition;

if (import.meta.main) {
  const channels = (Deno.env.get("CHANNEL_ACCOUNTS") ?? "")
    .split(",").map((address) => address.trim());
  await using executor = createChannelAccountsParallel({
    channels,
    worker: definition,
    maxPending: 100,
    timeoutMs: 60_000,
  });
  await executor.ready();
  const results = await Promise.all([
    executor.step("first.example"),
    executor.step("second.example"),
  ]);
  console.log(results.map((result) => result.hash));
}
```

Each address gets one worker, and each worker creates its pipeline/signers once
on first use. Independent requests use whichever healthy channel is available.
The initializer must load the requested account; mismatches fail before the
callable executes. The return type of `step` is inferred as the receipt object.
The scope drains and closes the workers when it exits; it does not merge the
on-chain accounts. Handle
[quarantine and recovery](../channel-accounts.md#failures-and-account-recovery)
before explicitly assigning failed accounts to another owner.

## Runtime integration

The SDK uses Convee's runtime transports: Deno module workers, Node/Bun worker
threads, and browser module workers. Each host needs a loader and permissions
for both the application module and its dependencies. Node/Bun applications
should use compiled ESM; the Deno environment-key loader above is
application-specific. A browser worker needs a browser-compatible
signer/provider created inside it; keep interactive wallet signers on the
[local path](../channel-accounts.md#bounded-local-execution). Workers add
startup and message-copying costs, so network-only workloads do not have an
automatic throughput advantage.

Vite needs a statically discoverable native Convee declaration. Replace the
second argument of `createChannelAccountsWorker` with this binding callback
(`initialize` is the initializer from the complete example):

```ts
import { worker } from "@fifo/convee/workers";
import { createChannelAccountsWorker } from "@colibri/plugin-channel-accounts";

export default createChannelAccountsWorker(
  initialize,
  (run) => worker(run, { module: import.meta.url }),
);
```

Add Convee's build integration to `vite.config.ts`:

```ts
import { conveeWorkers } from "@fifo/convee/workers/vite";

export default { plugins: [conveeWorkers()] };
```

This preserves the SDK's address envelope while allowing Convee to emit separate
worker entries. Attach caller plugins to `executor.step`, or pipeline plugins
inside `initialize`; do not attach plugins in the binding callback. A custom
`createWorker(entry, slot)` can supply another Convee-compatible transport, with
permissions and cancellation handled by the application adapter. The supplied
entry is the bootstrap, not the raw definition module.
