# useConnect

Connect an explicitly selected wallet connector.

Import from `@colibri/react`. Requires `ColibriProvider`; see
[setup](../setup.md). No QueryClient is needed for this hook.

## Parameters and result

The hook takes no parameters. Call the returned function with an ID from
`config.connectors`.

**Returns:** `(connectorId: string) => Promise<WalletConnection | null>`.

## Example

Pass a connector ID configured by your application.

<!-- deno-check @colibri/react -->

```tsx
import { useState } from "react";
import { useConnect, useConnection } from "@colibri/react";

export function ConnectWallet({ connectorId }: { connectorId: string }) {
  const action = useConnect();
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
        Connect wallet
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
```

## Behavior

Call from a user action. An unknown connector or a wallet/provider network
mismatch rejects the Promise. `useConnection` exposes the pending state and
failure. A later connect or disconnect invalidates an in-flight result.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/~/useConnect)
