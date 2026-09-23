# useSigners

Read the connected wallet’s explicit, guarded signing capabilities.

Import from `@colibri/react/signers`. Requires [`ColibriProvider`](../setup.md);
see [setup](../setup.md). No QueryClient is needed for this hook.

## Parameters and result

No parameters.

**Returns:** A readonly array of Core
[`Signer`](../../../core/signer/README.md#signer-capabilities) capabilities;
empty when disconnected.

## Example

<!-- deno-check @colibri/react -->

```tsx
import { useSigners } from "@colibri/react/signers";

export function SigningCapabilities() {
  const signers = useSigners();
  return <p>{signers.length} signing capabilities available.</p>;
}
```

## Behavior

Identity is checked before and after an external signing prompt. A disconnect,
account change or network change invalidates retained capabilities. An available
signer still must authorize the requested account/operation. An address,
especially a C-address, does not imply an envelope-signing capability. Pass
eligible signers explicitly into
[transaction configuration](../../../core/transaction-config.md); see
[wallets and sessions](../wallets-and-sessions.md).

## Outside React hooks

For application services outside a component, the same entrypoint exports
[`guardedSigners`](https://jsr.io/@colibri/react/doc/signers/~/guardedSigners)
and
[`assertConnection`](https://jsr.io/@colibri/react/doc/signers/~/assertConnection).
The complete function below accepts your existing
[`ColibriConfig`](../setup.md), captures its current connection and returns
guarded capabilities. It does not connect a wallet or prompt for a signature.

<!-- deno-check @colibri/react -->

```ts
import {
  assertConnection,
  type ColibriConfig,
  guardedSigners,
} from "@colibri/react/signers";

export function currentSigners(config: ColibriConfig) {
  const connection = config.getSnapshot().connection;
  assertConnection(config, connection);
  return guardedSigners(config, connection);
}
```

Retained capabilities reject a later disconnect or identity/network change.
Fetch the new connection explicitly before a new action. These guards preserve
the wallet's declared capabilities; they do not grant
[on-chain authorization](../../../core/authorization.md).

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/signers/~/useSigners)
