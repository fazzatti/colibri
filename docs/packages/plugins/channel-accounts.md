# @colibri/plugin-channel-accounts

`@colibri/plugin-channel-accounts` provides account management and two execution
paths:

- `ChannelAccounts` utilities for opening and closing sponsored channel accounts
- `createChannelAccountsPlugin(...)` for reusing those channels in write
  pipelines
- `createChannelAccountsConcurrent(...)` for
  [bounded local execution](#bounded-local-execution)
- `createChannelAccountsWorker(...)` and `createChannelAccountsParallel(...)`
  for [persistent workers](#persistent-worker-execution)

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
submit sequentially in batches of at most 15 channels. Lookup failure preserves
the first original error and rejects immediately; remaining read-only lookups in
that batch are observed as they settle, and no later transaction batch starts.

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

## Bounded local execution

Use `createChannelAccountsConcurrent` with a fixed set of
[channel accounts](#opening-channels) and an existing
[classic](../../core/pipelines/classic-transaction.md) or
[invoke](../../core/pipelines/invoke-contract.md) pipeline. This schedules one
ordinary request per call, with shared capacity equal to the number of distinct
account addresses. Duplicate addresses count once. It is local async
concurrency; it does not create threads or clone
[signers](../../core/signer/README.md).

```ts
const pipeline = createClassicTransactionPipeline({ networkConfig });
const execute = createChannelAccountsConcurrent({ channels, run: pipeline });
const result = await execute({ operations, config });
```

This fragment uses application-owned accounts and
[transaction configuration](../../core/transaction-config.md); the
[complete sponsorship example](channel-accounts/example.md) shows their setup.
Attach [fee sponsorship](fee-bump.md) and other inner plugins to `pipeline`.
Attach caller hooks with `execute.use(plugin)`, or pass `plugins` at
construction. Use one channel owner per pipeline: do not also attach a separate
channel pool to the wrapped pipeline.

| Option          | Behavior                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| `channels`      | Nonempty fixed account set, retained by reference.                                                       |
| `run`           | Existing pipeline or function accepting a [pipeline input](../../core/pipelines/classic-transaction.md). |
| `maxPending`    | Active plus queued calls across this definition; default 1024.                                           |
| `timeoutMs`     | Optional positive cooperative deadline in milliseconds; none by default.                                 |
| `id`, `plugins` | Native Convee caller identity and lifecycle hooks.                                                       |

The callable also supports `run`, `runWith`, `use` and `remove`. Per-call
`runWith({ signal, timeoutMs })` can cancel queued work. Active operations
retain their slot and account until actual execution and all native pipeline
finalizers finish, even if they ignore cancellation. A hung operation can
therefore delay completion indefinitely. No transaction is retried. A single
pipeline failure retains its original local error, and the input's signer/client
references and result identity remain intact. This path needs no shutdown
method.

The original [plugin](#using-the-plugin) remains available for dynamic channel
registration and [high-level clients](#advanced-usage-with-high-level-clients).
Neither approach coordinates account ownership with another independently
created pool or process; each account must have one application-level owner.

## Persistent worker execution

Use `createChannelAccountsWorker` in an application module and default-export
the result. Its initializer receives the assigned public address and returns
`{ channel, run }`. The SDK validates that the loaded account matches,
initializes once on first use, and never changes that worker's account. Create
[signers](../../core/signer/README.md), RPC clients and the
[pipeline](../../core/pipelines/classic-transaction.md) inside the initializer.
The [complete worker example](channel-accounts/example.md#run-with-workers)
shows both worker and caller in one import-safe module.

`createChannelAccountsParallel({ channels: publicAddresses, worker })` returns
an owner with a normal callable `step`. Arguments and results are inferred from
`run`. The account list is fixed and must contain unique valid public addresses;
there is exactly one worker per address. Requests take the next available
healthy account independently, not in fixed pairs or round-robin queues.

| Option/control                        | Behavior                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `maxPending`                          | Active plus waiting requests; default 1024. Full admission rejects before taking an account.          |
| `startupTimeoutMs`                    | Worker module/transport startup deadline; default 10000 ms.                                           |
| `timeoutMs`                           | Dispatch-to-reply deadline, including worker hooks; default 30000 ms. Queue time is excluded.         |
| `id`, `plugins`                       | Caller step identity/hooks. `step.use(plugin)` also attaches caller hooks.                            |
| `createWorker`                        | Optional native Convee runtime/build transport adapter.                                               |
| `ready()`                             | Optional module/transport preload; account/signing initialization still waits for the first request.  |
| `getChannels()`                       | Defensive account-state snapshots, retained after shutdown.                                           |
| `close()`, `dispose()`, `await using` | Reject waiting/new work, drain active requests and release transports. Shutdown is terminal.          |
| `terminate()`                         | Hard-stop transports and quarantine outstanding account work. Worker finalizers cannot be guaranteed. |

Caller hooks run outside the remote account execution. A plugin attached to the
worker-local pipeline runs remotely and finishes before the account is released.
The SDK owns the address envelope; bind build-tool declarations without adding
hooks to that envelope. See
[runtime integration](channel-accounts/example.md#runtime-integration).

Pass structured-cloneable request data and plain results: primitives, byte
arrays and deliberate data records. Do not pass functions, live clients, signers
or native SDK instances expecting their prototypes to survive. Native
`SharedArrayBuffer` sharing is explicit and needs application synchronization.
Caller context is not copied; each worker job gets fresh context with its
assigned address. Returning data does not merge worker state back into the
caller.

### Failures and account recovery

`getChannels()` distinguishes:

- `available`: no request currently owns the account;
- `busy`: a request holds its lease;
- `unavailable`: the worker failed to start or its transport group is
  unavailable;
- `quarantined`: task failure, crash, timeout, reply-clone failure or forced
  termination makes the outcome uncertain.

A quarantined account receives no more work from that owner. Inspect the
[typed failure](../../reference/errors/plugins-channel-accounts-shared.md),
reconcile its transaction/sequence state with the ledger, then explicitly create
a new owner for recovered accounts. Unavailable accounts need their startup or
loader issue corrected before a fresh owner is created. Healthy accounts can
continue independently. If none remain, waiting/new requests fail immediately.
Caller error recovery can return a fallback value, but cannot remove quarantine.

There are no automatic transaction retries, worker replacements, idle shutdowns
or reopen-after-close. Use explicit lifetime ownership. These controls stop
worker execution; [ChannelAccounts.close](#closing-channels) is the separate
on-chain account-merge operation. Never merge accounts while requests are
active. Worker isolation can help execution separation; it does not provide
cross-process account locks or inherently accelerate RPC I/O. Interactive
signers usually belong on the [local path](#bounded-local-execution).
