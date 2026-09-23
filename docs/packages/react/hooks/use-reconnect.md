# useReconnect

Restore a previously authorized wallet connection without prompting.

Import from [`@colibri/react`](../../react.md). Requires
[`ColibriProvider`](../setup.md); see [setup](../setup.md). No QueryClient is
needed for this hook.

## Parameters and result

The hook takes no parameters. Call the returned function with an ID from
`config.connectors`.

**Returns:** `(connectorId: string) => Promise<WalletConnection | null>`.

## Example

Pass a connector ID configured by your application.

<!-- deno-check @colibri/react -->

```tsx
import { useState } from "react";
import { useConnection, useReconnect } from "@colibri/react";

export function RestoreWallet({ connectorId }: { connectorId: string }) {
  const action = useReconnect();
  const { status } = useConnection();
  const [error, setError] = useState("");
  return (
    <section>
      <button
        disabled={status === "connecting"}
        onClick={() => {
          setError("");
          void action(connectorId).catch((cause) => setError(String(cause)));
        }}
      >
        Restore wallet
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
```

## Behavior

Restoration is explicit: the hook never runs it automatically on mount. It calls
only the connector’s optional `reconnect` method. If that method is absent or
returns no authorized connection, the result is `null` and state stays
disconnected. It does not fall back to a permission-prompting connect.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/~/useReconnect)
