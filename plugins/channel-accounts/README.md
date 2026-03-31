# Channel Accounts Plugin

Utilities for managing sponsored Stellar channel accounts and reusing them in
Colibri classic and Soroban transaction pipelines.

[📚 Documentation](https://colibri-docs.gitbook.io/) |
[💡 Examples](https://github.com/fazzatti/colibri-examples)

## Exports

- `ChannelAccounts` for opening and closing channel accounts
- `createChannelAccountsPlugin` for classic and invoke contract pipelines

## Quick start

Create channels, register them in the plugin, and attach the plugin to the
pipeline you want to accelerate.

```ts
import {
  ChannelAccounts,
  createChannelAccountsPlugin,
} from "@colibri/plugin-channel-accounts";
import { createClassicTransactionPipeline, NetworkConfig } from "@colibri/core";

const networkConfig = NetworkConfig.TestNet();
const channels = await ChannelAccounts.open({
  numberOfChannels: 2,
  sponsor,
  networkConfig,
  config,
});

const plugin = createChannelAccountsPlugin({ channels });
const pipeline = createClassicTransactionPipeline({ networkConfig });
pipeline.use(plugin);
```

## Opening channels

`ChannelAccounts.open(...)` creates and funds a bounded set of sponsored channel
accounts.

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

- Channels are opened with a starting balance so they can act as transaction
  sources without requiring a separate fee-bump layer.
- Channel closing uses a direct channel-sourced `accountMerge`, which works even
  when the sponsor was added as a signer during channel creation.
- Adding the sponsor as a channel signer affects the on-chain account shape, but
  it does not yet make sponsor-only signing automatic through current Colibri
  pipeline signing requirements.
