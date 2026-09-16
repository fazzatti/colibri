# Common React workflows

Start with high-level composition; use the granular APIs when the application
needs separate cache, connection, signer or transaction control. Both routes use
the same state stores and Core clients. Import features through subpaths so a
connection-only consumer does not load transaction serialization or wallet SDKs.

## One provider and one wallet hook

The application initializes Wallets Kit and chooses its wallet modules. In this
example **every configured module must support both envelope and authorization
entry signing for a G-account**. For a mixed set, return capabilities per
module; use `{ envelope: true }` for an envelope-only module or supply custom
Core signers for contract-account policies. Never infer permission from method
presence.

<!-- deno-check @colibri/react -->

```tsx
import { useState } from "react";
import { createColibriConfig } from "@colibri/react";
import { ColibriQueryProvider } from "@colibri/react/provider";
import { useWallet } from "@colibri/react/wallet";
import { createWalletSigner } from "@colibri/react/wallets/signer";
import {
  createStellarWalletsKitConnector,
  type StellarWalletsKitApi,
} from "@colibri/react/ecosystem/stellar-wallets-kit";
import { NetworkConfig } from "@colibri/core/network";

function WalletPanel() {
  const wallet = useWallet();
  const [failure, setFailure] = useState<string>();
  async function toggle() {
    try {
      setFailure(undefined);
      if (wallet.status === "connected") await wallet.disconnect();
      else await wallet.connect();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    }
  }
  return (
    <section>
      <p>{wallet.address ?? "Connect your wallet"}</p>
      <button
        disabled={wallet.status === "connecting"}
        onClick={() => void toggle()}
      >
        {wallet.status === "connected" ? "Disconnect" : "Connect"}
      </button>
      {failure && <p role="alert">{failure}</p>}
    </section>
  );
}

export function WalletApp({ kit }: { kit: StellarWalletsKitApi }) {
  const [config] = useState(() =>
    createColibriConfig({
      network: NetworkConfig.TestNet(),
      connectors: [createStellarWalletsKitConnector(kit, {
        capabilities: () => ({ signer: createWalletSigner }),
      })],
    })
  );
  return (
    <ColibriQueryProvider config={config}>
      <WalletPanel />
    </ColibriQueryProvider>
  );
}
```

The provider owns an isolated cache. Pass `queryClient` if the application
already has one; Colibri will not clear that caller-owned cache. No global
singleton is shared across server requests. Keep configuration stable per
application/request; release an application-owned configuration with
`config.destroy()` when its lifetime ends. Owned caches are cleared when their
provider unmounts.

[`useWallet()`](hooks/use-wallet.md) exposes state, address, guarded signers,
connector choices and explicit `connect`, `reconnect`, and `disconnect` actions.
No action runs during render. Omit the connector id only when exactly one
connector is configured. `reconnect` restores existing authority without
prompting; it never runs silently.

## One signer for both transaction stages

`createWalletSigner({ address, networkPassphrase, signTransaction, signAuthEntry })`
returns one Core signer with `signTransaction` and `signSorobanAuthEntry`.
Pipelines choose the required capability automatically. Authorization validation
and envelope network validation are the same as in the granular factories. Kit
additionally guards account, module and network before and after prompts.

A combined signer targets its own G-account. For separate signer/account
authority, contract-account policies or a wallet supporting only one form, use
`createWalletEnvelopeSigner`, `createWalletAuthEntrySigner`, or an explicit Core
signer. Neither route submits a transaction by itself.

## Invoke with wallet defaults

Use
[`useWalletContractInvoke(client, "method")`](hooks/use-wallet-contract-invoke.md)
from `/contracts/invoke` with the same loaded/generated client used by reads. It
fills missing `config.source` and `config.signers` from the connected wallet.
Supply the generated `methodArgs` to `mutateAsync`. Fees and timeout retain the
client's existing defaults; optional `config` overrides pass through unchanged.
The return type remains the generated method's decoded result and transaction
metadata.

For example, if your generated client exposes `increment`, the invocation is:

```ts
// Fragment: `client` is your loaded, generated contract client.
const increment = useWalletContractInvoke(client, "increment");
await increment.mutateAsync({ methodArgs: { amount: 1 } });
```

The hook does not replace the client's pipeline, plugins or error matcher. An
explicit source and signer list permit caller-owned authority without a wallet
connection. Overrides are independent; an explicit signer list is never appended
to. A contract-wallet identity requires an explicit G-account transaction
source. Stale wallet-derived signers reject after a connection change. There are
no automatic mutation retries or signing prompts during rendering.

The granular `useContractInvoke` remains available for fully explicit
orchestration. For Classic or custom Soroban pipelines, use the transaction
hooks and pass `useWallet().signers`; the original pipeline remains responsible
for execution.

## Handle concrete failures

React failures have dedicated subclasses such as `ReactNetworkMismatchError` and
`ReactConnectionChangedError`. Catch the specific class or the
`ColibriReactError` family; stable `REACT_*` codes remain unchanged. SDK,
connector and caller-owned errors preserve identity. The legacy generic family
constructor is retained for source compatibility, but library implementations
use concrete classes.

API references: [provider](https://jsr.io/@colibri/react/doc/provider),
[wallet](https://jsr.io/@colibri/react/doc/wallet),
[combined signer](https://jsr.io/@colibri/react/doc/wallets/signer),
[invocation](https://jsr.io/@colibri/react/doc/contracts/invoke).
