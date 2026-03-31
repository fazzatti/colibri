# @colibri/plugin-channel-accounts

`@colibri/plugin-channel-accounts` provides two related pieces:

- `ChannelAccounts` utilities for opening and closing sponsored channel
  accounts
- `createChannelAccountsPlugin(...)` for reusing those channels in write
  pipelines

## Installation

```bash
deno add jsr:@colibri/plugin-channel-accounts
```

## Opening Channels

```ts
import { ChannelAccounts } from "@colibri/plugin-channel-accounts";
import { NetworkConfig } from "@colibri/core";

const networkConfig = NetworkConfig.TestNet();

const channels = await ChannelAccounts.open({
  numberOfChannels: 2,
  sponsor,
  networkConfig,
  config,
});
```

`ChannelAccounts.open(...)` accepts:

| Property             | Description                                                  |
| -------------------- | ------------------------------------------------------------ |
| `numberOfChannels`   | Number of channels to create                                 |
| `sponsor`            | Sponsor account used to create and fund the channels         |
| `networkConfig`      | Colibri network configuration                                |
| `config`             | Transaction config used to submit the setup transaction      |
| `rpc`                | Optional explicit RPC client                                 |
| `setSponsorAsSigner` | Also add the sponsor as a sponsored signer on each channel   |

When `setSponsorAsSigner` is enabled, the sponsor is added as a signer with
weight `1` inside the sponsorship block.

## Closing Channels

```ts
await ChannelAccounts.close({
  channels,
  sponsor,
  networkConfig,
  config,
});
```

Closing uses a channel-sourced `accountMerge` back into the sponsor.

## Using The Plugin

The plugin allocates one channel account per pipeline run, swaps it into
`input.config.source`, appends the channel signer, and releases the channel
when the run finishes or fails.

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

By default the plugin can be attached to:

- `createClassicTransactionPipeline(...)`
- `createInvokeContractPipeline(...)`

You can also scope it explicitly:

```ts
import {
  CLASSIC_TRANSACTION_PIPELINE_ID,
  createClassicTransactionPipeline,
} from "@colibri/core";
import { createChannelAccountsPlugin } from "@colibri/plugin-channel-accounts";

const plugin = createChannelAccountsPlugin({
  channels,
  target: CLASSIC_TRANSACTION_PIPELINE_ID,
});

const pipeline = createClassicTransactionPipeline({ networkConfig });
pipeline.use(plugin);
```

## Advanced Usage With High-Level Clients

`Contract` and `StellarAssetContract` expose the owned invoke pipeline:

```ts
import { createChannelAccountsPlugin } from "@colibri/plugin-channel-accounts";

const plugin = createChannelAccountsPlugin({ channels });

contract.invokePipe.use(plugin);
sac.contract.invokePipe.use(plugin);
```

## Notes

- Channels are opened with a starting balance so they can act as transaction
  sources without a separate fee-bump layer
- Adding the sponsor as a signer changes the on-chain account shape, but it
  does not make sponsor-only signing automatic through current Colibri signing
  requirements
