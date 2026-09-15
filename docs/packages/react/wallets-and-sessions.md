# Wallets and sessions in React

Colibri uses one general `WalletConnector` contract. Applications can implement
it for their existing wallet integration or choose an ecosystem adapter. All
adapters remain in `@colibri/react`, under separate public entrypoints:

| Import                                         | Purpose                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `@colibri/react/wallets`                       | General connector types, `createWalletConnector` and `createWalletEnvelopeSigner`. |
| `@colibri/react/ecosystem/stellar-wallets-kit` | `createStellarWalletsKitConnector` for an application-owned Kit.                   |
| `@colibri/react/ecosystem/freighter`           | `createFreighterConnector` for direct Freighter integration.                       |

The adapter modules use upstream SDK **types** without importing wallet
runtimes. The application chooses which SDK/module code to load. The single
package's install/type dependency graph still includes the SDKs; separate
entrypoints control browser retention, not package installation. Supported APIs
are Wallets Kit **2.6+ within 2.x** and Freighter API **6.0.1+ within 6.x**.

## Stellar Wallets Kit

Wallets Kit owns wallet selection, its modal, configured modules and SDK state.
Colibri translates its connection and signing operations into Core capabilities.
It does not initialize the Kit, select modules, or replace its UI. Use one
connector per initialized Kit: the upstream SDK is a static, application-wide
instance.

Install the SDK in your application if it is not already a direct dependency:

```sh
npm install @creit.tech/stellar-wallets-kit@^2.6.0
```

This complete `WalletApp.tsx` loads the Kit only in the browser, configures its
Freighter module, and uses its own selection modal when the user clicks Connect.
Add the wallet modules your app supports and declare their capabilities in the
callback. A Colibri provider alone suffices for connection hooks; add the
[QueryClient provider](../react.md) when using data-query hooks.

<!-- deno-check @colibri/react -->

```tsx
import { useEffect, useState } from "react";
import { NetworkConfig } from "@colibri/core/network";
import {
  type ColibriConfig,
  ColibriProvider,
  createColibriConfig,
  useConnect,
  useConnection,
  useDisconnect,
} from "@colibri/react";
import { createStellarWalletsKitConnector } from "@colibri/react/ecosystem/stellar-wallets-kit";

function ConnectButton() {
  const connection = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const [error, setError] = useState<string>();

  async function toggle() {
    setError(undefined);
    try {
      if (connection.status === "connected") await disconnect();
      else await connect("stellar-wallets-kit");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <section>
      <button
        disabled={connection.status === "connecting"}
        onClick={() => void toggle()}
      >
        {connection.status === "connected" ? "Disconnect" : "Connect wallet"}
      </button>
      {connection.connection && <p>{connection.connection.address}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export function WalletApp() {
  const [config, setConfig] = useState<ColibriConfig>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let disposed = false;
    let owned: ColibriConfig | undefined;
    async function initialize() {
      const [
        { StellarWalletsKit },
        { FreighterModule, FREIGHTER_ID },
        { Networks },
      ] = await Promise.all([
        import("@creit.tech/stellar-wallets-kit/sdk"),
        import("@creit.tech/stellar-wallets-kit/modules/freighter"),
        import("@creit.tech/stellar-wallets-kit/types"),
      ]);
      if (disposed) return;
      StellarWalletsKit.init({
        modules: [new FreighterModule()],
        network: Networks.TESTNET,
      });
      owned = createColibriConfig({
        network: NetworkConfig.TestNet(),
        connectors: [
          createStellarWalletsKitConnector(StellarWalletsKit, {
            capabilities: ({ module }) => ({
              envelope: module.productId === FREIGHTER_ID,
            }),
          }),
        ],
      });
      setConfig(owned);
    }
    void initialize().catch((cause) => {
      if (!disposed) setError(String(cause));
    });
    return () => {
      disposed = true;
      owned?.destroy();
    };
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!config) return <p>Loading wallet support…</p>;
  return (
    <ColibriProvider config={config}>
      <ConnectButton />
    </ColibriProvider>
  );
}
```

### API and capability policy

`createStellarWalletsKitConnector(kit, options)` returns `WalletConnector`.
`kit` is the application's initialized SDK, typed from the actual upstream API.

- `options.id` defaults to `stellar-wallets-kit`.
- Required `options.capabilities({ module, address, networkPassphrase })`
  returns `WalletsKitCapabilities`. Set `envelope: true` only for a supported
  G-address envelope-signing path. Return `signers` for other explicit Core
  capabilities and `messageSigner` for SEP-53. Omitted capabilities stay absent;
  method presence and wallet names do not establish support.
- Optional `options.connect` replaces `kit.authModal()` with application-owned
  selection UI. It must update the Kit's active account and return that same
  `{ address }`. Calling `setWallet()` alone does not establish an account.
- `reconnect` reads the Kit's already-cached account and the selected module's
  network. It never invokes `fetchAddress()` or a modal. A cached identity is
  not proof of current signing authority; the wallet still approves signatures.
- State events refresh account/network state. Wallet selection or Kit disconnect
  immediately clears the Colibri connection. Reconnect with an explicit Connect
  action after selecting another wallet: Kit can retain the previous wallet's
  cached address, so that value cannot establish the new connection.
- Envelope signing rechecks the account, module and network before and after the
  request, and rejects a different returned signer when the wallet supplies one.
  It only signs; Colibri's existing pipeline performs submission.
- Unsubscribe/provider cleanup releases Kit event listeners and ignores late
  reads. Explicit disconnect also invokes the Kit's disconnect operation.

The adapter does not invent authentication-entry or message capabilities for
selected wallets. Core's `AuthEntrySigner` transforms a complete authorization
entry; the upstream wallet method accepts an authorization preimage and returns
a signature. Supply an explicitly adapted Core signer when needed. The same
applies to message encoding and SEP-53 semantics. Application-provided signers
retain their original Core contract; `useSigners` and `useSignMessage` add the
provider's connection guards.

The Kit may persist its own connection preferences. Colibri neither configures
nor duplicates that persistence. Keep Kit initialization in the browser and
scope Colibri configuration per application/request for SSR.

Sources: [Kit structure](https://stellarwalletskit.dev/kit-structure.html),
[events](https://stellarwalletskit.dev/how-to/kit-events.html),
[signing capabilities](https://stellarwalletskit.dev/how-to/sign-with-wallet.html).
[Colibri adapter reference](https://jsr.io/@colibri/react/doc/ecosystem/stellar-wallets-kit).

## Direct Freighter

Use this adapter when the application integrates directly with Freighter.
Install `@stellar/freighter-api@^6.0.1`. The following complete configuration
factory accepts the actual SDK; call it in the browser and render the
[standard provider](../react.md) around your components.

<!-- deno-check @colibri/react -->

```ts
import type * as Freighter from "@stellar/freighter-api";
import { NetworkConfig } from "@colibri/core/network";
import { createColibriConfig } from "@colibri/react";
import { createFreighterConnector } from "@colibri/react/ecosystem/freighter";

export function configureFreighter(freighter: typeof Freighter) {
  return createColibriConfig({
    network: NetworkConfig.TestNet(),
    connectors: [createFreighterConnector(freighter)],
  });
}
```

`createFreighterConnector(api, options?)` accepts the SDK's actual
`requestAccess`, `getAddress`, `getNetworkDetails` and `signTransaction` types;
`FreighterApi` is derived from the upstream module, not a handwritten copy.
`options.id` defaults to `freighter`; `pollIntervalMs` defaults to 2,000 ms.

Call `useConnect()("freighter")` from a user action. Reconnect reads without
prompting. Account/network changes are polled; disconnect stops polling and
clears Colibri authority, without revoking the extension's website permission.
Each envelope signature checks identity before and after the prompt and verifies
the returned signer address. This adapter exposes envelope signing only.

[Freighter reads](https://docs.freighter.app/extension-freighter-api/reading-data),
[signing](https://docs.freighter.app/extension-freighter-api/signing),
[Colibri adapter reference](https://jsr.io/@colibri/react/doc/ecosystem/freighter).

## Other wallets and smart accounts

`createWalletConnector` accepts `connect`, optional non-prompting `reconnect`,
optional `disconnect`, and `subscribe(listener) => cleanup`. It preserves the
application's implementation. A connection reports `address`,
`networkPassphrase`, `signers` and an optional `messageSigner`. No ecosystem SDK
is required by this contract.

Use
`createWalletEnvelopeSigner({ publicKey, networkPassphrase, accounts?,
signTransaction })`
to bridge complete transaction-XDR signing. The public key is the actual Ed25519
signer, independently of any controlled account. Supply Core `AuthEntrySigner`
or `MessageSigner` capabilities separately when available. A contract account
does not imply envelope-signing authority.

[Generic wallet API](https://jsr.io/@colibri/react/doc/wallets).

## WebAuth

`useWebAuthClient(domain)` discovers a client through SEP-1 and exposes ordinary
query state. An application can instead construct an existing `WebAuthClient`.
Create the session outside rendering once that client is available:

<!-- deno-check -->

```ts
import { createWebAuthSession } from "@colibri/react/session";
import type { ColibriConfig } from "@colibri/react";
import type { WebAuthClient } from "@colibri/webauth";

export function createApplicationSession(
  config: ColibriConfig,
  client: WebAuthClient,
) {
  const session = createWebAuthSession(config, client);
  return { session, dispose: () => session.destroy() };
}
```

Within the same provider, `useSession(session)` returns the current state and
`useWebAuth(session)` returns an authentication mutation. Call
`authenticate.mutateAsync({ account, signer })` for SEP-10 with the existing
Core keypair-signer contract, or supply the existing WebAuth SEP-45 `authorize`
options for a contract account. See [WebAuth](../webauth.md) for complete
protocol setup, challenge validation and authorization examples.

Read the token from `session.getSnapshot().token` or `useSession`; it is not
placed in query/mutation result data. Token decoding alone cannot establish a
session. Tokens returned by the completed exchange must be current and bound to
the expected account and home domain. Use the token only with the intended
service; the server remains responsible for authentication and authorization.

Call `session.logout()` for local logout, and `session.destroy()` when disposing
the scope. Wallet changes and expiration clear the token automatically. Create
fresh configs/sessions per server request; never share credentials across users.

## Discovery and presentation

`useStellarToml(domain, options, query, scope)` returns the full SEP-1 facade,
including currency and service advertisements. Different custom fetchers or
validation policies need distinct scopes. `useIdenticon(address)` returns a
local SVG data URL. `AccountIdenticon` requires explicit `alt` text (empty for
decoration); it uses the SVG-only renderer, with no PNG encoder in that import.

API modules: [wallets](https://jsr.io/@colibri/react/doc/wallets),
[signers](https://jsr.io/@colibri/react/doc/signers),
[WebAuth](https://jsr.io/@colibri/react/doc/webauth),
[sessions](https://jsr.io/@colibri/react/doc/session),
[SEP-1](https://jsr.io/@colibri/react/doc/sep1),
[identicons](https://jsr.io/@colibri/react/doc/identicon).
