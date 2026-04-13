# Channel Accounts Plugin

Utilities for managing sponsored Stellar channel accounts and reusing them in
Colibri classic and Soroban transaction pipelines.

[📚 Documentation](https://fifo-docs.gitbook.io/colibri) |
[💡 Examples](https://github.com/fazzatti/colibri-examples)

## Exports

- `ChannelAccounts` for opening and closing channel accounts
- `createChannelAccountsPlugin` for classic and invoke contract pipelines

## Quick start

Create channels, register them in the plugin, and pair them with a fee-bump
plugin if you want zero-balance channels to submit transactions immediately.

```ts
import {
  ChannelAccounts,
  createChannelAccountsPlugin,
} from "@colibri/plugin-channel-accounts";
import { createFeeBumpPlugin } from "@colibri/plugin-fee-bump";
import { createClassicTransactionPipeline, NetworkConfig } from "@colibri/core";

const networkConfig = NetworkConfig.TestNet();
const channels = await ChannelAccounts.open({
  numberOfChannels: 2,
  sponsor,
  networkConfig,
  config,
});

const channelAccountsPlugin = createChannelAccountsPlugin({ channels });
const feeBumpPlugin = createFeeBumpPlugin({
  networkConfig,
  feeBumpConfig: {
    source: sponsor.address(),
    fee: "10000000",
    signers: [sponsor.signer()],
  },
});
const pipeline = createClassicTransactionPipeline({ networkConfig });
pipeline.use(channelAccountsPlugin);
pipeline.use(feeBumpPlugin);
```

## Opening channels

`ChannelAccounts.open(...)` creates a bounded set of sponsored channel accounts.

- `numberOfChannels` — number of channels to open
- `sponsor` — account funding and sponsoring the channels
- `networkConfig` — Colibri network configuration
- `config` — transaction config used to submit the setup transaction
- `rpc` — optional explicit RPC client
- `setSponsorAsSigner` — optional flag to also add the sponsor as a signer on
  each created channel

When `setSponsorAsSigner` is enabled, the signer is created as a sponsored
subentry with weight `1`.

```ts
const channels = await ChannelAccounts.open({
  numberOfChannels: 2,
  sponsor,
  setSponsorAsSigner: true,
  networkConfig,
  config,
});
```

## Closing channels

`ChannelAccounts.close(...)` merges channel accounts back into the sponsor.

```ts
await ChannelAccounts.close({
  channels,
  sponsor,
  networkConfig,
  config,
});
```

## Plugin usage

The plugin allocates one channel per pipeline run, swaps it into
`input.config.source`, appends the channel signer, and releases the channel when
the run finishes or fails.

By default the plugin can be attached to:

- `createClassicTransactionPipeline(...)`
- `createInvokeContractPipeline(...)`

You can also scope it to one target explicitly:

```ts
import { createChannelAccountsPlugin } from "@colibri/plugin-channel-accounts";
import {
  CLASSIC_TRANSACTION_PIPELINE_ID,
  createClassicTransactionPipeline,
  NetworkConfig,
} from "@colibri/core";

const networkConfig = NetworkConfig.TestNet();
const plugin = createChannelAccountsPlugin({
  channels,
  target: CLASSIC_TRANSACTION_PIPELINE_ID,
});
const pipeline = createClassicTransactionPipeline({ networkConfig });
pipeline.use(plugin);
```

For advanced usage with higher-level clients, attach the plugin to the owned
invoke pipe:

```ts
const sac = StellarAssetContract.fromContractId({
  networkConfig,
  contractId,
});

sac.contract.invokePipe.use(plugin);
```

## Notes

- Channels are opened with `0` balance.
- If you want zero-balance channels to submit transactions immediately, either
  fund them separately or combine the pipeline with
  `@colibri/plugin-fee-bump`.
- Channel closing keeps the channel as the `accountMerge` operation source while
  letting the caller-provided transaction config pay the network fee.
- Adding the sponsor as a channel signer affects the on-chain account shape, but
  it does not yet make sponsor-only signing automatic through current Colibri
  pipeline signing requirements.
