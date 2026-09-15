# Wallets and sessions in React

Start with the [React provider setup](../react.md). These integrations are
headless: the application owns buttons, wallet selection and consent UI.

## Freighter

Install `@stellar/freighter-api` in the application. The following is an
application fragment; `freighter` is the imported API module and rendering the
provider follows the main guide.

```ts
import * as freighter from "@stellar/freighter-api";
import { NetworkConfig } from "@colibri/core/network";
import { createColibriConfig } from "@colibri/react";
import { createFreighterConnector } from "@colibri/react/wallets";

const config = createColibriConfig({
  network: NetworkConfig.TestNet(),
  connectors: [createFreighterConnector(freighter)],
});
```

In a descendant component, `const connect = useConnect()` returns a function.
Call `await connect("freighter")` inside the connect button handler and handle
its rejection. `useConnection()` exposes status, account, capabilities and any
connection error. `useReconnect()("freighter")` uses non-prompting discovery.
Freighter account/network changes are polled every two seconds; disconnect stops
polling. Each signature additionally rechecks account/network before and after
the prompt and verifies the returned signer address.

The adapter supplies envelope signing only. Freighter's auth-entry API accepts a
preimage and returns a signature, whereas Core's AuthEntrySigner transforms a
complete entry. These shapes must not be equated. Add an explicit adapter for
that capability when required. The injected API is based on the official
[Freighter reads](https://docs.freighter.app/extension-freighter-api/reading-data)
and [signing APIs](https://docs.freighter.app/extension-freighter-api/signing).

## Other wallets and smart accounts

`createWalletConnector` accepts `connect`, optional non-prompting `reconnect`,
optional `disconnect`, and `subscribe(listener) => cleanup`. Report the actual
network and explicit signers; do not infer signing authority from an address.
Use `createWalletEnvelopeSigner` for a complete transaction-XDR signer, and
provide Core AuthEntrySigner or MessageSigner capabilities independently.

Wallets Kit's `signTransaction` can be bridged this way. Its selected wallets
have different capabilities; consult the
[Wallets Kit signing API](https://stellarwalletskit.dev/how-to/sign-with-wallet.html).
The application owns wallet selection and translates kit state events into
connector updates. `useSigners` wraps supplied transaction capabilities with
connection guards; `useSignMessage` requires an explicit SEP-53 MessageSigner.

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
