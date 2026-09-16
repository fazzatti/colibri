# useNetwork

Read the provider’s configured Stellar network.

Import from `@colibri/react`. Requires `ColibriProvider`; see
[setup](../setup.md). No QueryClient is needed for this hook.

## Parameters and result

No parameters.

**Returns:** The immutable `NetworkConfig` snapshot owned by the provider.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useNetwork } from "@colibri/react";

export function NetworkLabel() {
  const network = useNetwork();
  return <p>Network: {network.networkPassphrase}</p>;
}
```

## Behavior

This is the application network, not a command to switch the wallet. Replace the
application config to change networks. A connection must report the matching
network passphrase.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/~/useNetwork)
