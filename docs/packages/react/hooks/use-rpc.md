# useRpc

Access a memoized Stellar RPC client for advanced calls.

Import from `@colibri/react/rpc`. Requires [`ColibriProvider`](../setup.md); see
[setup](../setup.md). No QueryClient is needed for this hook.

## Parameters and result

No parameters.

**Returns:** The native SDK `Server` for the configured RPC URL.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useState } from "react";
import { useRpc } from "@colibri/react/rpc";

export function ReadLedger() {
  const rpc = useRpc();
  const [message, setMessage] = useState("Not requested");
  return (
    <section>
      <button
        onClick={() => {
          void rpc.getLatestLedger().then(
            (ledger) => setMessage(`Ledger ${ledger.sequence}`),
            (error) => setMessage(String(error)),
          );
        }}
      >
        Read latest ledger
      </button>
      <output>{message}</output>
    </section>
  );
}
```

## Behavior

The client follows the provider RPC URL and `allowHttp` setting. A missing URL
throws [`REACT_002`](../../../reference/errors/react.md). Construction makes no
request. Calls through this client do not automatically use the query cache;
prefer [useLatestLedger](use-latest-ledger.md) for a reactive ledger query.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/rpc/~/useRpc)
