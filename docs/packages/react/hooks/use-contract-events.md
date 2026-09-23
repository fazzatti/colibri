# useContractEvents

Observe an application-owned, shared contract-event stream.

Import from `@colibri/react/events`. Requires [`ColibriProvider`](../setup.md);
see [setup](../setup.md). No QueryClient is needed for this hook.

## Parameters and result

- `subscription`: a stable `ContractEventsSubscription` from
  `createContractEvents(config, options)`.

**Returns:** `ContractEventsState`: `status`, a bounded `events` array and
optional `error`.

## Example

Create the subscription once in the application scope with the provider config
and your filters. Pass that same object to components that should share a
stream; see
[shared contract events](../contracts-and-transactions.md#shared-contract-events).

<!-- deno-check @colibri/react -->

```tsx
import {
  type ContractEventsSubscription,
  useContractEvents,
} from "@colibri/react/events";

export function EventFeed(
  { subscription }: { subscription: ContractEventsSubscription },
) {
  const state = useContractEvents(subscription);
  return (
    <section>
      <p>{state.status}</p>
      {state.status === "error" && (
        <>
          <p role="alert">{String(state.error)}</p>
          <button onClick={() => subscription.restart()}>Retry stream</button>
        </>
      )}
      <ul>{state.events.map((event) => <li key={event.id}>{event.id}</li>)}</ul>
    </section>
  );
}
```

## Behavior

The subscription must belong to the same provider config. The first observer
starts streaming; the last unsubscribe stops waits and ignores late responses.
Defaults retain the most recent 100 events. Failures require explicit restart,
and replay remains limited by RPC retention. Call `subscription.destroy()` when
its application scope ends. SSR exposes an idle snapshot.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/events/~/useContractEvents)
