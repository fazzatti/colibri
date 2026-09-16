# useWallet

Observe wallet state, guarded signers and explicit connection actions together.

Import from `@colibri/react/wallet`. Requires `ColibriProvider`, supplied by
`ColibriQueryProvider` or mounted separately; see [setup](../setup.md). This
hook does not require a QueryClient.

## Parameters and result

No parameters. **Returns:** `WalletState`, with `status`, optional `connection`,
`address` and `error`, guarded `signers`, configured `connectors`, and these
actions:

- `connect(id?)`: request a connection through the selected connector.
- `reconnect(id?)`: restore previously authorized authority without prompting.
- `disconnect()`: clear local authority and disconnect the wallet when
  supported.

All actions return Promises. Omit `id` only when exactly one connector is
configured; otherwise select one explicitly.

## Example

Configure the connectors once as shown in [common workflows](../convenience.md).
This component offers each configured connector and handles action failures.

<!-- deno-check @colibri/react -->

```tsx
import { useState } from "react";
import { useWallet } from "@colibri/react/wallet";

export function WalletPanel() {
  const wallet = useWallet();
  const [failure, setFailure] = useState<string>();
  async function run(action: () => Promise<unknown>) {
    setFailure(undefined);
    try {
      await action();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  }
  return (
    <section>
      <p>{wallet.address ?? "Choose a wallet"}</p>
      {wallet.status === "connected"
        ? (
          <button onClick={() => void run(wallet.disconnect)}>
            Disconnect
          </button>
        )
        : wallet.connectors.map((connector) => (
          <button
            key={connector.id}
            disabled={wallet.status === "connecting"}
            onClick={() => void run(() => wallet.connect(connector.id))}
          >
            {connector.id}
          </button>
        ))}
      {failure && <p role="alert">{failure}</p>}
    </section>
  );
}
```

## Behavior

The hook composes the existing connection and signer hooks. Rendering never
connects, reconnects or signs. Retained wallet-derived signers reject after a
connection change. Capability declarations belong to the application and
connector; an address alone does not imply signing support. Server rendering
uses the disconnected connection snapshot.

## See also

- [All hooks](README.md)
- [Wallets and sessions](../wallets-and-sessions.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/wallet/~/useWallet)
