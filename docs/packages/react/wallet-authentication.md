# Authenticate with a connected wallet

This example uses an application-configured connector and discovered
`WebAuthClient`. Set both to the same network and choose a service advertising
SEP-10. See [wallet setup](wallets-and-sessions.md) for Freighter and Stellar
Wallets Kit connectors; the authentication flow uses their shared Core envelope
capability and does not import either vendor SDK.

The mount function below owns the query cache and session. The account and
signer come from `useWallet()`, so they stay bound to the active connection.
Connection and signing happen only after separate button clicks.

<!-- deno-check @colibri/react -->

```tsx
// @deno-types="npm:@types/react-dom@^19.1.9/client"
import { createRoot } from "npm:react-dom@^19.1.1/client";
import { QueryClient } from "@tanstack/react-query";
import { isEnvelopeSigner } from "@colibri/core";
import type { WebAuthClient } from "@colibri/webauth";
import type { ColibriConfig } from "@colibri/react";
import { ColibriQueryProvider } from "@colibri/react/provider";
import { useWallet } from "@colibri/react/wallet";
import {
  createWebAuthSession,
  useSession,
  useWebAuth,
  type WebAuthSession,
} from "@colibri/react/webauth";

function Authentication({ session }: { session: WebAuthSession }) {
  const wallet = useWallet();
  const authentication = useWebAuth(session);
  const state = useSession(session);
  const account = wallet.address;
  const signer = wallet.signers.find(isEnvelopeSigner);
  const eligible = !!account && !account.startsWith("C") && !!signer;

  return (
    <section>
      <p>Wallet: {wallet.status}</p>
      {wallet.connectors.map((connector) => (
        <button
          key={connector.id}
          disabled={wallet.status === "connecting"}
          onClick={() => void wallet.connect(connector.id).catch(() => {})}
        >
          Connect {connector.id}
        </button>
      ))}
      {wallet.error instanceof Error && (
        <p role="alert">{wallet.error.message}</p>
      )}
      <button
        disabled={!eligible || authentication.isPending}
        onClick={() => {
          if (account && signer) authentication.mutate({ account, signer });
        }}
      >
        {authentication.isPending
          ? "Waiting for authentication"
          : "Authenticate"}
      </button>
      <p>Session: {state.status}</p>
      {authentication.isError && (
        <p role="alert">{authentication.error.message}</p>
      )}
      <button onClick={() => session.logout()}>Log out</button>
    </section>
  );
}

export function mountAuthentication(
  element: HTMLElement,
  config: ColibriConfig,
  client: WebAuthClient,
): () => void {
  const queryClient = new QueryClient();
  const session = createWebAuthSession(config, client);
  const root = createRoot(element);
  root.render(
    <ColibriQueryProvider config={config} queryClient={queryClient}>
      <Authentication session={session} />
    </ColibriQueryProvider>,
  );
  return () => {
    root.unmount();
    session.destroy();
    queryClient.clear();
    // The application owns config and disposes it when its wallet scope ends.
  };
}
```

`useWebAuth` first verifies the server's challenge, then awaits the wallet. It
exchanges only a validated signed envelope. A rejected prompt, changed body,
missing/invalid signature or expired challenge fails the mutation without a
retry. The authentication server checks account signer weights. Contract
accounts use [SEP-45](../webauth/sep45.md) and an explicit authorization
handler.

Logout, disconnect, account/network change and session disposal invalidate
pending SEP-10 approval. A late response cannot establish a session or start a
token exchange. Cancellation does not dismiss the wallet UI or recall a POST
already sent. Read current validity from `useSession`, not a previous successful
mutation. Tokens stay in the session, outside mutation results and browser
storage; do not persist/dehydrate authentication mutation variables or log JWTs.

- [SEP-10 verification and signer details](../webauth/sep10.md)
- [useWebAuth](hooks/use-web-auth.md)
- [useSession](hooks/use-session.md)
- [Exact WebAuth API](https://jsr.io/@colibri/webauth/doc)
