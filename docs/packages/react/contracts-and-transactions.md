# Contract and pipeline recipes

Use the [provider and QueryClient setup](../react.md) before calling these
hooks. A connected account and an explicitly eligible signer are separate
inputs.

## Generated contract clients

Generate a client with [Contract Bindings](../contract-bindings.md). This
application fragment assumes `Counter` is your generated client with `getCount`
and `increment` helpers, and that the contract is deployed.

```ts
const contract = useContract(() =>
  new Counter({
    networkConfig: network,
    contractConfig: { contractId },
  }), [network, contractId]);
const readOptions = { contract, method: "getCount" as const, args: [] as [] };
const count = useContractRead(readOptions);
const increment = useContractInvoke(contract, "increment", {
  onSuccess: () =>
    queryClient.invalidateQueries({
      queryKey: contractReadQueryOptions(config, readOptions).queryKey,
    }),
});
// In an explicit user-action handler:
await increment.mutateAsync({
  methodArgs: { by: 1 },
  config: transactionConfig,
});
```

Use imports from `@colibri/react/contracts`, or the separate `/contracts/read`
and `/contracts/invoke` entries. `transactionConfig` is the existing Core
configuration: source, fee, timeout, signers and optional memo/extraSigners. Use
a distinct read `scope` when custom pipelines/plugins change query semantics.
The returned full contract retains its deployment, spec, metadata, events and
plugin capabilities. No second contract orchestration system is introduced.

## Read without constructing a full Contract

This complete component accepts a loaded spec and deployed contract ID from its
parent. It simulates an argument-free `get_count` ABI method. Core errors and
loading state are displayed; the simulation does not update the ledger.

<!-- deno-check -->

```ts
import { createElement } from "npm:react@^19.1.1";
import type { ContractId, Spec } from "@colibri/core/contract-read";
import { useContractReadSpec } from "@colibri/react/contracts/read";

export function Count(
  { contractId, spec }: { contractId: ContractId; spec: Spec },
) {
  const query = useContractReadSpec(
    { contractId, spec, method: "get_count" },
    (value) => Number(value),
  );
  return createElement(
    "output",
    null,
    query.isError ? query.error.message : query.data ?? "Loading…",
  );
}
```

The framework-independent action is `readContract` from
`@colibri/core/contract-read`; it uses the same codecs and read pipeline as
`Contract.read`. A supplied `rpc` or `pipeline` must match the provider network.
Provide a distinct `scope` when overriding these dependencies. Validators can
replace the example's number conversion for richer result types.

## Classic and Soroban transactions

`useClassicTransaction()` accepts `{ operations, config }`, preserving Classic
operation outcomes, memos and muxed sources supported by Core.
`useSorobanTransaction()` accepts the existing InvokeContractPipeline input. It
builds, simulates, authorizes, assembles, signs and submits through Core. Call
`mutateAsync` in an action handler; never during render.

For plugins, construct and configure the ordinary Core pipeline once, then pass
`{ pipeline }` to its matching transaction hook. Plugins retain their stable
pipeline and step IDs and are owned by the supplied pipeline. The application
must use a pipeline configured for the provider's network. See
[pipeline guides](../../core/pipelines/README.md) for input, fees, signing and
plugin compatibility.

`useSimulateSorobanTransaction` is a separate mutation for a prepared native
transaction. It returns the complete simulation response, including any
restoration preamble, without signing or submitting. Use that response to
present fees/resources or decide an explicit next action. A successful
simulation is not a guarantee that a later submission will succeed.

Signing/submission mutations never retry automatically. Pending represents the
whole pipeline; the existing send step resolves with a terminal result. The hash
lookup hooks are separate observations: `useTransaction(hash)` reads once
subject to Query policy; `useWaitForTransaction(hash)` polls each second until
SUCCESS or FAILED. NOT_FOUND is not proof of failure. Set `enabled: false`,
unmount, or override `refetchInterval` to stop a lookup that remains NOT_FOUND.

## Shared contract events

Create a subscription once with
`createContractEvents(config, { filters,
startLedger, maxEvents: 100 })`;
observe it from multiple components with `useContractEvents(subscription)`. The
first subscriber starts the streamer, and the last cleanup aborts waits and
rejects late delivery. Retained events are bounded and deduplicated by ID.
`restart()` explicitly retries from the configured ledger; replay beyond the
retained window can redeliver older events. Use Core's event registries/SEP-41
event parsers to decode returned events.

## Server prefetching and query identity

`contractReadQueryOptions(config, options)` produces the same key and function
used by the hook. `colibriQueryOptions` builds application queries with the same
network/provider namespace. `queryValue` is a canonical cache-key
representation, not a result serializer. Preserve the distinction when
dehydrating bigint, maps, bytes, XDR and Core class instances; an
application-specific serializer and hydration adapter are required for those
values. Prefetching can also remain server-only and send an explicitly formatted
view model to the client.

API modules: [contracts](https://jsr.io/@colibri/react/doc/contracts),
[reads](https://jsr.io/@colibri/react/doc/contracts/read),
[invocations](https://jsr.io/@colibri/react/doc/contracts/invoke),
[classic](https://jsr.io/@colibri/react/doc/transactions/classic),
[Soroban](https://jsr.io/@colibri/react/doc/transactions/soroban),
[simulation](https://jsr.io/@colibri/react/doc/transactions/simulate),
[events](https://jsr.io/@colibri/react/doc/events),
[queries](https://jsr.io/@colibri/react/doc/query),
[RPC](https://jsr.io/@colibri/react/doc/rpc),
[accounts](https://jsr.io/@colibri/react/doc/accounts),
[balances](https://jsr.io/@colibri/react/doc/assets).
