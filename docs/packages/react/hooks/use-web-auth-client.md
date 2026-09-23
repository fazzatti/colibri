# useWebAuthClient

Discover a unified SEP-10/SEP-45 WebAuth client for a service domain.

Import from `@colibri/react/webauth`. Use under both
[`ColibriProvider`](../setup.md) and [`QueryClientProvider`](../setup.md); see
[setup](../setup.md).

## Parameters and result

- `domain`: service home domain, or `undefined` to disable automatic fetching.
- `options?`: WebAuth construction options except `network`, supplied by the
  provider.
- `query?`: query controls.
- `scope?`: cache discriminator; defaults to `"default"`.

**Returns:** A query result containing
[`WebAuthClient`](../../webauth/discovery.md).

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useWebAuthClient } from "@colibri/react/webauth";

export function AuthService({ domain }: { domain?: string }) {
  const client = useWebAuthClient(domain);
  if (!domain) return <p>Select a service.</p>;
  if (client.isError) return <p role="alert">{client.error.message}</p>;
  return (
    <p>{client.data ? "Authentication service discovered." : "Discovering…"}</p>
  );
}
```

## Behavior

Discovery uses [SEP-1](../../../core/sep1.md) and the provider network. It does
not authenticate the user. Use a distinct scope for custom fetchers or discovery
policies. Once discovered, create one application-owned session and authenticate
explicitly; see [wallets and sessions](../wallets-and-sessions.md#webauth).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/webauth/~/useWebAuthClient)
