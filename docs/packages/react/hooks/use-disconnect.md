# useDisconnect

Clear the active connection and request wallet-side disconnection when
supported.

Import from `@colibri/react`. Requires `ColibriProvider`; see
[setup](../setup.md). No QueryClient is needed for this hook.

## Parameters and result

No parameters.

**Returns:** `() => Promise<void>`.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useState } from "react";
import { useDisconnect } from "@colibri/react";

export function DisconnectWallet() {
  const disconnect = useDisconnect();
  const [error, setError] = useState("");
  return (
    <section>
      <button
        onClick={() => {
          setError("");
          void disconnect().catch((cause) => setError(String(cause)));
        }}
      >
        Disconnect
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
```

## Behavior

Local authority clears immediately, even if wallet-side cleanup fails.
Observation ends and stale callbacks cannot reconnect the app. Bound WebAuth
sessions clear their credentials. This does not promise to revoke the wallet’s
website permission or a server-side session.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/~/useDisconnect)
