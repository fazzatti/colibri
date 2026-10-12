# Channel Accounts Plugin

This release requires Stellar SDK `>=17.2.1 <18`. See the
[Core 3 and SDK migration guide](https://fifo-docs.gitbook.io/colibri/getting-started/compatibility#core-30-and-sdk-1721-migration)
for affected package versions, corrected codecs and preserved cursor behavior.

Version 3.x requires
[Core 3.x](https://fifo-docs.gitbook.io/colibri/core/overview) and follows
Colibri's
[compatibility and independent release policy](https://fifo-docs.gitbook.io/colibri/getting-started/compatibility).
Compatible updates within that Core major do not require this package to release
again unless its API or required dependency floor changes.

Utilities for managing sponsored Stellar channel accounts and reusing them in
Colibri classic and Soroban transaction pipelines.

<a href="https://jsr.io/@colibri/plugin-channel-accounts">
  <img src="https://jsr.io/badges/@colibri/plugin-channel-accounts" alt="JSR @colibri/plugin-channel-accounts" />
</a>
<a href="https://jsr.io/@colibri/plugin-channel-accounts">
  <img src="https://jsr.io/badges/@colibri/plugin-channel-accounts/total-downloads" alt="JSR total downloads for @colibri/plugin-channel-accounts" />
</a>

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
const executeClassicTransaction = createClassicTransactionPipeline({
  networkConfig,
});
executeClassicTransaction.use(channelAccountsPlugin);
executeClassicTransaction.use(feeBumpPlugin);
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

Release uses Convee's `onFinally` hook, after the pipeline's input, body, error
handling, and output hooks settle. This also releases the channel when another
plugin's hook rejects, regardless of that plugin's registration order. If the
run fails before allocation, finalization has nothing to release. When the pool
is exhausted, waiting runs resume as channels are released.

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
const executeClassicTransaction = createClassicTransactionPipeline({
  networkConfig,
});
executeClassicTransaction.use(plugin);
```

For advanced usage with higher-level clients, attach the plugin to the owned
invoke pipe:

```ts
const sac = await StellarAssetContract.fromContractId({
  networkConfig,
  contractId,
});

sac.contract.invokePipe.use(plugin);
```

## Concurrency and queueing

The existing plugin uses Convee async concurrency in the calling runtime. Keep
using the same pipeline and live signers; configure limits on the plugin:

```ts
const channelAccountsPlugin = createChannelAccountsPlugin({
  channels,
  concurrency: 4,
  maxPending: 100,
});
const send = createClassicTransactionPipeline({ networkConfig });
send.use(channelAccountsPlugin);
const receipts = await Promise.all(inputs.map((input) => send(input)));
```

Here `inputs` contains your ordinary pipeline inputs. `concurrency` caps
admitted runs across every pipeline sharing the plugin, including runs waiting
for an account. `maxPending` caps admitted plus queued runs. Both accept
positive safe integers and have no configured limit when omitted. Available
channels still bound actual transaction concurrency; duplicate account addresses
count once.

`registerChannels` remains available, including after construction with an empty
pool. Adding channels unblocks account waiters without changing an explicit
concurrency limit. One permit and account stay held until the plugin's finally
hook. A hung run keeps its slot; there is no automatic timeout, cancellation,
transaction retry or shutdown method. Share one plugin when sharing accounts.

Invalid limits throw Convee `ConcurrencyError` (`CNC_CONFIG`) at construction.
Overflow rejects the pipeline call with `CNC_CAPACITY` before acquiring a
channel. Catch that rejection at the call site: native input-hook failures
bypass body error hooks, while finalization still runs. Existing transaction and
plugin errors keep their native behavior.

`ChannelAccounts.close({ ...args, concurrency: 4 })` separately bounds signer
lookups per closing batch, defaulting to 15. Batches still submit sequentially;
the first lookup failure rejects immediately while other read-only lookups
settle. Wait for pipeline runs before merging their accounts.

See the
[concurrency guide](https://fifo-docs.gitbook.io/colibri/packages/plugins/channel-accounts#concurrency-and-queueing)
and
[complete example](https://fifo-docs.gitbook.io/colibri/packages/plugins/channel-accounts/example).

## Notes

- Channels are opened with `0` balance.
- If you want zero-balance channels to submit transactions immediately, either
  fund them separately or combine the pipeline with `@colibri/plugin-fee-bump`.
- Channel closing keeps the channel as the `accountMerge` operation source while
  letting the caller-provided transaction config pay the network fee.
- Adding the sponsor as a channel signer affects the on-chain account shape, but
  it does not yet make sponsor-only signing automatic through current Colibri
  pipeline signing requirements.
