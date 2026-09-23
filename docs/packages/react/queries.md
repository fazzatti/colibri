# Queries and caching

Query hooks share the TanStack QueryClient supplied by
[`ColibriQueryProvider`](setup.md) or the application's own provider. Mount it
as shown in [setup and providers](setup.md). Queries observe data; mutations run
only when the application calls `mutate` or `mutateAsync`.

## Query controls

The optional `query` argument accepts `QueryControls<T>`: ordinary TanStack
options except `queryKey`, `queryFn` and `queryKeyHashFn`. Colibri owns those
three so callers cannot accidentally replace a feature's identity or executor.
Use `enabled`, `staleTime`, `refetchInterval`, `retry` and other observation
controls to match the application's needs. The default stale time is 10 seconds;
other query defaults come from TanStack Query and your QueryClient.

Hooks that accept a missing identifier disable automatic fetching until it is
present. `enabled: false` is not input validation and does not prevent an
explicit `refetch()` call. Supply valid arguments before manually fetching. A
disabled query can be pending without fetching; account for that in loading UI.

[`useContractRead({ contract: undefined, ... })`](hooks/use-contract-read.md)
has a stronger missing-client guard: it uses `skipToken`, so manual refetch
cannot execute either. Supplying `enabled: true` cannot bypass this guard. Pass
the loaded client to enable it.

[`useContractReadSpec`](hooks/use-contract-read-spec.md) takes a separate
decoder instead of `select`. Decoding happens per observer, while the cache
retains Core's canonical decoded value.

## Identity and custom policies

Keys include the network passphrase, provider `scope`, feature and canonical
arguments. Give different scopes to RPC sources or custom pipelines/discovery
policies that can return different data for otherwise identical inputs. For a
generated contract, keys also include its address, RPC URL and a SHA-256
fingerprint of its ABI. Spec reads also use that fingerprint. Current XDR is
checked before reusing a cached digest, including when a spec mutates in place.
The fingerprint identifies the supplied ABI; it does not verify deployed Wasm.

`queryValue` supports bigint, bytes, maps and XDR-serializable inputs. It
rejects unsupported class instances, cyclic values and non-finite numbers. This
is a cache-key representation, not a serializer for query results.

## Prefetch and invalidate

Use
[`contractReadQueryOptions(config, options)`](hooks/use-contract-read-spec.md)
to produce the same key and executor as
[`useContractRead(options)`](hooks/use-contract-read.md). Prefetch with that
object and invalidate its `queryKey` after an action changes the underlying
data. The library cannot infer which other accounts or contracts a transaction
changed.

This complete helper accepts the same typed options as the hook:

<!-- deno-check @colibri/react -->

```ts
import { QueryClient } from "@tanstack/react-query";
import type { ColibriConfig } from "@colibri/react";
import {
  type ContractIdentity,
  type ContractReadOptions,
  contractReadQueryOptions,
  type ReadMethodName,
} from "@colibri/react/contracts/read";

export async function prefetchContract<
  C extends ContractIdentity,
  M extends ReadMethodName<C>,
>(
  client: QueryClient,
  config: ColibriConfig,
  options: ContractReadOptions<C, M>,
) {
  const query = contractReadQueryOptions(config, options);
  await client.prefetchQuery(query);
  return () => client.invalidateQueries({ queryKey: query.queryKey });
}
```

`colibriQueryOptions` and `colibriQueryKey` are also available for your own
application query features without importing React runtime code from that entry.

## Token precision caching

[`useBalance`](hooks/use-balance.md) and
[`useTokenMetadata`](hooks/use-token-metadata.md) share
[SEP-41](../../core/asset/sep-41-token-contract.md) decimals under the
`token-decimals` feature key for five minutes. Their outer queries keep their
own freshness settings. Invalidate that shared key after a known token upgrade,
then refresh any balance/metadata queries that already contain the old
precision.

This helper invalidates the precision entry before the caller refreshes its
affected views:

<!-- deno-check @colibri/react -->

```ts
import type { QueryClient } from "@tanstack/react-query";
import {
  type ColibriConfig,
  colibriQueryKey,
  type ContractId,
} from "@colibri/react/query";

export async function invalidateTokenDecimals(
  client: QueryClient,
  config: ColibriConfig,
  contractId: ContractId,
) {
  await client.invalidateQueries({
    queryKey: colibriQueryKey(config, "token-decimals", contractId),
  });
}
```

## Mutation policy

Mutation hooks accept callbacks and `MutationControls`, but do not expose retry,
executor or mutation-scope overrides. Automatic retries are always disabled.
Mutations share a serial queue for the network/provider scope within one
QueryClient. This is not an account-sequence lock across tabs, devices or
clients.

`mutate` reports errors through mutation state and callbacks; `mutateAsync`
returns a Promise that the caller must handle. Pending covers the whole Core
operation. Reconcile an ambiguous submission outcome before submitting again.
See [contract and pipeline recipes](contracts-and-transactions.md).

For an existing SDK facade or compound action, use
[`useColibriMutation`](hooks/use-colibri-mutation.md) from `/query/mutation`. It
applies the same mutation policy; the action retains responsibility for its own
validation, wallet authority, network, submission and receipt handling.

## Server rendering and credentials

Create fresh configuration and QueryClient instances per server request. Bigint,
Core class instances and other rich results need an application-specific
serialization/hydration policy. Do not JSON-stringify an arbitrary QueryClient.
You can also prefetch server-side and send a formatted view model to the client.

WebAuth tokens stay in the shared session, outside query/mutation result data
and browser storage. Do not persist or dehydrate authentication mutation
variables; they contain signing inputs. See
[wallets and sessions](wallets-and-sessions.md).

API references: [query utilities](https://jsr.io/@colibri/react/doc/query) and
[contract read options](https://jsr.io/@colibri/react/doc/contracts/read).
