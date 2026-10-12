# @colibri/plugin-channel-accounts

`@colibri/plugin-channel-accounts` provides:

- [`ChannelAccounts`](#opening-channels) for opening and closing sponsored
  accounts.
- [`createChannelAccountsPlugin(...)`](#using-the-plugin) for reusing channels
  in existing write pipelines, with optional
  [concurrency limits](#concurrency-and-queueing).

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

| Property             | Description                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `numberOfChannels`   | Number of channels to create                                                                |
| `sponsor`            | Sponsor account used to create and fund the channels                                        |
| `networkConfig`      | Colibri network configuration                                                               |
| `config`             | [Transaction config](../../core/transaction-config.md) used to submit the setup transaction |
| `rpc`                | Optional explicit RPC client                                                                |
| `setSponsorAsSigner` | Also add the sponsor as a sponsored signer on each channel                                  |

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

Closing uses a channel-sourced `accountMerge` back into the sponsor. The
optional `concurrency` setting bounds simultaneous signer lookups within each
batch; it must be a positive safe integer and defaults to 15. Transactions still
submit sequentially in batches of at most 15 channels. The first lookup failure
rejects immediately using the existing
[typed error wrapping](../../reference/errors/plugins-channel-accounts-shared.md);
remaining read-only lookups in that batch are observed as they settle, and no
later transaction batch starts.

## Using The Plugin

The plugin allocates one channel account per pipeline run, swaps it into
`input.config.source`, appends the channel signer, and releases the channel when
the run finishes or fails.

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
const executeClassicTransaction = createClassicTransactionPipeline({
  networkConfig,
});

executeClassicTransaction.use(plugin);
```

By default the plugin can be attached to:

- [`createClassicTransactionPipeline(...)`](../../core/pipelines/classic-transaction.md)
- [`createInvokeContractPipeline(...)`](../../core/pipelines/invoke-contract.md)

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

const executeClassicTransaction = createClassicTransactionPipeline({
  networkConfig,
});
executeClassicTransaction.use(plugin);
```

## Advanced Usage With High-Level Clients

[`Contract`](../../core/contract.md) and
[`StellarAssetContract`](../../core/asset/stellar-asset-contract.md) expose the
owned [invoke pipeline](../../core/pipelines/invoke-contract.md):

```ts
import { createChannelAccountsPlugin } from "@colibri/plugin-channel-accounts";

const plugin = createChannelAccountsPlugin({ channels });

contract.invokePipe.use(plugin);
sac.contract.invokePipe.use(plugin);
```

## Notes

- Channels are opened with `startingBalance: "0"` under reserve sponsorship.
  Sponsoring their reserve does not pay transaction fees. Pair their use as
  transaction sources with fee bumps or fund them deliberately.
- Adding the sponsor as a signer changes the on-chain account shape, but it does
  not make sponsor-only signing automatic through current Colibri signing
  requirements

## Preserve the operation source

The plugin changes `config.source` and appends the channel signer. It does not
rewrite operation sources. An operation without an explicit source inherits the
channel after this change. Set a payment operation's `source` to the account
that should send the asset and keep its signer in `config.signers`.

## Pool lifecycle

The pool leases one channel per run ID. Convee's `onFinally` releases it after
input, body, error, and output processing settles, including failures in other
plugins' hooks. Cleanup does not replace the original result or error. If
allocation was never reached, cleanup is a no-op. A hung invocation still holds
its channel until it settles; finalization is not a timeout mechanism.

When all channels are busy, additional runs wait and resume upon release. The
plugin provides `registerChannels(channels)` and `getChannels()`. A shared
in-memory pool does not coordinate with another process or independently created
plugin.

Wait for all runs before closing channels. `ChannelAccounts.close` merges the
accounts; it can use a sponsor proxy when on-chain signer/threshold checks
permit it, otherwise it uses each channel's signer. Persist channel secrets
securely if the channels must survive a process restart.

See
[all channel errors](../../reference/errors/plugins-channel-accounts-shared.md)
and the [complete sponsorship example](channel-accounts/example.md).

## Concurrency and queueing

[`createChannelAccountsPlugin`](#using-the-plugin) uses Convee's local async
scheduler. Attach it to your existing
[classic](../../core/pipelines/classic-transaction.md) or
[invoke](../../core/pipelines/invoke-contract.md) pipeline. The pipeline, its
other [plugins](../../core/plugins/README.md), live
[signers](../../core/signer/README.md) and RPC clients stay in the same runtime.

```ts
const channelPlugin = createChannelAccountsPlugin({
  channels,
  concurrency: 4,
  maxPending: 100,
});
const send = createClassicTransactionPipeline({ networkConfig });
send.use(channelPlugin);
const receipts = await Promise.all(inputs.map((input) => send(input)));
```

This fragment uses application-owned [channels](#opening-channels),
[network configuration](../../core/network.md), and `inputs` containing ordinary
[pipeline inputs](../../core/pipelines/classic-transaction.md). The
[complete sponsorship example](channel-accounts/example.md) shows the full
setup. High-level clients keep their
[existing attachment points](#advanced-usage-with-high-level-clients).

| Option        | Behavior                                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `channels`    | Initial [channel pool](#pool-lifecycle); may be empty. Duplicate addresses count once.                                                                         |
| `target`      | Optional [supported pipeline ID](#using-the-plugin); both write pipelines by default.                                                                          |
| `concurrency` | Positive safe integer limiting admitted runs across all pipelines sharing this plugin. Includes runs waiting for an account. No configured limit when omitted. |
| `maxPending`  | Positive safe integer limiting admitted plus queued runs. No configured limit when omitted. Overflow rejects before account acquisition.                       |

Actual transactions are also limited by the number of available
[channel accounts](#pool-lifecycle). Four admission slots and two accounts allow
at most two transactions at a time. Registering additional accounts unblocks
account waiters; it does not change an explicitly configured admission limit.
Without a configured cap, new accounts immediately increase usable capacity.
Waiting requests proceed in arrival order as capacity and accounts become free.
Limits are shared by pipelines using the **same plugin instance**; independently
created plugins do not coordinate account ownership.

The permit and account remain held until the plugin's
[finalization hook](#pool-lifecycle), including after input, output and error
hook failures. Results and existing errors retain their native behavior, and
nested input values keep their identities. The input/config containers are
copied for [source injection](#preserve-the-operation-source). There is no
execution owner to close, automatic retry or cancellation deadline. A hung run
keeps its permit and account; wait for every run before
[closing channels](#closing-channels).

Invalid limits throw Convee's typed `ConcurrencyError` with `CNC_CONFIG` during
construction. When `maxPending` is reached, `CNC_CAPACITY` rejects the pipeline
call before any account or transaction work. Catch it at the call site, like
other input-hook failures: native body-error recovery hooks do not run for input
failures. Finalization still runs, and subsequent calls can proceed after
capacity is released. These dependency-owned errors accompany the
[Colibri channel errors](../../reference/errors/plugins-channel-accounts-shared.md).
