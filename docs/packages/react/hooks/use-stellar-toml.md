# useStellarToml

Fetch and validate a domain’s [SEP-1](../../../core/sep1.md) stellar.toml
discovery document.

Import from `@colibri/react/sep1`. Use under both
[`ColibriProvider`](../setup.md) and [`QueryClientProvider`](../setup.md); see
[setup](../setup.md).

## Parameters and result

- `domain`: a home domain, or `undefined` to disable automatic fetching.
- `options?`: `StellarTomlOptions` (fetching, validation, HTTP policy and
  timeout).
- `query?`: query controls.
- `scope?`: cache discriminator; defaults to `"default"`.

**Returns:** A query result containing Core’s
[`StellarToml`](../../../core/sep1.md) facade.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useStellarToml } from "@colibri/react/sep1";

export function DiscoveredCurrencies({ domain }: { domain?: string }) {
  const discovery = useStellarToml(domain);
  if (!domain) return <p>Select a domain.</p>;
  if (discovery.isError) return <p role="alert">{discovery.error.message}</p>;
  return (
    <p>
      {discovery.data
        ? `${discovery.data.currencies.length} advertised currencies`
        : "Loading…"}
    </p>
  );
}
```

## Behavior

Use distinct scopes for custom fetchers or validation policies that can return
different data. Service URLs and currencies are advertisements, not a guarantee
that a service is reachable or supported. This hook does not implement
SEP-6/12/24/31/38 services. See [SEP-1](../../../core/sep1.md).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/sep1/~/useStellarToml)
