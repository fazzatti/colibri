# useColibriConfig

Read the application configuration supplied by the nearest provider.

Import from `@colibri/react`. Requires `ColibriProvider`; see
[setup](../setup.md). No QueryClient is needed for this hook.

## Parameters and result

No parameters.

**Returns:** `ColibriConfig`, including the network snapshot, connectors, scope
and connection methods.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useColibriConfig } from "@colibri/react";

export function AvailableWallets() {
  const config = useColibriConfig();
  return (
    <ul>
      {config.connectors.map((wallet) => <li key={wallet.id}>{wallet.id}</li>)}
    </ul>
  );
}
```

## Behavior

Create the config once per application, or once per server request. A missing
provider throws `ColibriReactError` with `REACT_001`. The config owns connection
state; use [useConnection](use-connection.md) to subscribe to it.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/~/useColibriConfig)
