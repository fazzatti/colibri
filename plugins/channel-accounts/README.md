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
- `createChannelAccountsConcurrent` for bounded local pipeline execution
- `createChannelAccountsWorker` and `createChannelAccountsParallel` for a
  separate persistent worker path with one account per worker

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

## Bounded local execution

Wrap an existing pipeline when the account set is fixed. One distinct account
provides one execution slot, shared across overlapping calls. Signers, clients
and returned objects retain their identities. These fragments use the configured
`channels`, `networkConfig`, `operations` and `config` from your application.

```ts
const pipeline = createClassicTransactionPipeline({ networkConfig });
const execute = createChannelAccountsConcurrent({
  channels,
  run: pipeline,
  maxPending: 100,
});
const result = await execute({ operations, config });
```

Import `createChannelAccountsConcurrent` from this package. The result is a
normal Convee step with `runWith`, `use` and `remove`; it needs no `close`.
`maxPending` defaults to 1024 and counts active plus queued requests. Optional
`timeoutMs` and `runWith({ signal })` stop queued work but wait for actual
active execution and cleanup. Original pipeline failures propagate without
replay. Use one channel owner for a pipeline; the original plugin remains
available when you need `registerChannels` or attachment to an existing client.

`ChannelAccounts.close({ ...args, concurrency: 4 })` separately bounds signer
lookups per closing batch. Its default is 15. Transaction batches still submit
sequentially, and the first lookup failure is reported immediately while the
remaining read-only lookups settle.

## Persistent worker execution

A worker module default-exports
`createChannelAccountsWorker(initialize,
{ module: import.meta.url })`. Its lazy
initializer receives a public address and returns `{ channel, run }`: the
matching account and a worker-local function or pipeline. Initialize keys and
clients there, then return plain data from `run`. Importing the definition
starts no workers or account operations.

```ts
import documentWorker from "./document-worker.ts";
import { createChannelAccountsParallel } from "@colibri/plugin-channel-accounts";

await using executor = createChannelAccountsParallel({
  channels: channelAddresses,
  worker: documentWorker,
  maxPending: 100,
});
await executor.ready(); // Optional module/transport preload.
const receipt = await executor.step(request);
```

The step's inputs and output are inferred from the worker. Each public address
owns one persistent worker; requests use the next available healthy channel.
`executor.step.use(plugin)` adds caller hooks; plugins attached to a pipeline
inside the initializer execute inside that worker. Functions, signers, clients
and native SDK instances must stay on their own side of the clone boundary.

`close()`/`dispose()` drain active work and reject waiting/new requests;
`terminate()` stops workers immediately and quarantines outstanding accounts.
Shutdown is terminal. Workers and transactions are never automatically retried.
`getChannels()` reports available, busy, unavailable (startup failed), or
quarantined (execution outcome needs reconciliation) accounts. Healthy channels
can continue after another channel fails. Reconcile quarantined accounts with
the ledger before explicitly assigning them to a fresh owner. A caller error
plugin recovering a value does not remove quarantine.

Defaults are 1024 active/queued requests, 10 seconds for worker startup, and 30
seconds from dispatch to reply; configure `startupTimeoutMs`/`timeoutMs` as
needed. Neither this owner nor the local plugin coordinates account use with
other independently created owners or processes.

See the
[complete worker example and runtime integration](https://fifo-docs.gitbook.io/colibri/packages/plugins/channel-accounts/example#run-with-workers)
for a runnable Testnet module, native Convee declarations for Vite, and runtime
loader/permission requirements. The local path is usually appropriate for
network I/O and interactive signers; workers add isolation, startup and
serialization costs, without a promised throughput gain.

## Notes

- Channels are opened with `0` balance.
- If you want zero-balance channels to submit transactions immediately, either
  fund them separately or combine the pipeline with `@colibri/plugin-fee-bump`.
- Channel closing keeps the channel as the `accountMerge` operation source while
  letting the caller-provided transaction config pay the network fee.
- Adding the sponsor as a channel signer affects the on-chain account shape, but
  it does not yet make sponsor-only signing automatic through current Colibri
  pipeline signing requirements.
