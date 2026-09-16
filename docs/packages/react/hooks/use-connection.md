# useConnection

Observe the current wallet connection and connection lifecycle.

Import from `@colibri/react`. Requires `ColibriProvider`; see
[setup](../setup.md). No QueryClient is needed for this hook.

## Parameters and result

No parameters.

**Returns:** `ConnectionState`: `status`, optional `connectorId`, `connection`
and `error`. Status is `disconnected`, `connecting` or `connected`.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useConnection } from "@colibri/react";

export function WalletStatus() {
  const { status, connection, error } = useConnection();
  return (
    <section>
      <p>{status}: {connection?.address ?? "No account selected"}</p>
      {error !== undefined && <p role="alert">{String(error)}</p>}
    </section>
  );
}
```

## Behavior

The server-rendered snapshot is always disconnected. Observing state does not
prompt a wallet or reconnect. An address and its signing capabilities are
separate: inspect [useSigners](use-signers.md) before a signing action.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/~/useConnection)
