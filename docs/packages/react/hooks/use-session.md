# useSession

Observe a shared, memory-only WebAuth session.

Import from `@colibri/react/webauth`. Requires `ColibriProvider`; see
[setup](../setup.md). No QueryClient is needed for this hook.

## Parameters and result

- `session`: the application-owned `WebAuthSession` created for this provider
  config and service client.

**Returns:** `SessionState`: `status` (`anonymous`, `authenticating` or
`authenticated`) and an optional `token`.

## Example

Create the shared session as described in
[WebAuth setup](../wallets-and-sessions.md#webauth), then pass it to components
below the same provider.

<!-- deno-check @colibri/react -->

```tsx
import { useSession, type WebAuthSession } from "@colibri/react/webauth";

export function SessionStatus({ session }: { session: WebAuthSession }) {
  const state = useSession(session);
  return (
    <section>
      <p>{state.status}</p>
      <button onClick={() => session.logout()}>Log out</button>
    </section>
  );
}
```

## Behavior

The session and provider must share the exact config object. Tokens clear on
connection changes, logout and expiry; SSR exposes an anonymous snapshot. Tokens
remain outside query caches and browser storage. Use them only with the intended
service, not in rendered markup. Logout does not revoke a server-side session.
Destroy the session when its application scope ends.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/webauth/~/useSession)
