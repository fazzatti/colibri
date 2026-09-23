# useWebAuth

Authenticate on demand through a shared WebAuth session.

Import from `@colibri/react/webauth`. Use under both
[`ColibriProvider`](../setup.md) and [`QueryClientProvider`](../setup.md); see
[setup](../setup.md).

## Parameters and result

- `session`: the application-owned
  [`WebAuthSession`](../wallets-and-sessions.md#webauth).
- `options?`: mutation callbacks and controls.
- Call the mutation with
  [`WebAuthAuthenticationOptions`](../../webauth/discovery.md), including the
  account and explicit protocol-specific signing/authorization inputs.

**Returns:** A `void` mutation result; successful credentials live in the
session, not mutation result data.

## Example

The parent supplies a stable session and the appropriate
[SEP-10](../../webauth/sep10.md) or [SEP-45](../../webauth/sep45.md) request.
See the [protocol guides](../../webauth.md) before constructing the
authentication inputs.

<!-- deno-check @colibri/react -->

```tsx
import {
  useWebAuth,
  type WebAuthAuthenticationOptions,
  type WebAuthSession,
} from "@colibri/react/webauth";

export function Authenticate({ session, request }: {
  session: WebAuthSession;
  request: WebAuthAuthenticationOptions;
}) {
  const authentication = useWebAuth(session);
  return (
    <section>
      <button
        disabled={authentication.isPending}
        onClick={() => authentication.mutate(request)}
      >
        Authenticate
      </button>
      {authentication.isError && (
        <p role="alert">{authentication.error.message}</p>
      )}
      {authentication.isSuccess && <p>Authentication completed.</p>}
    </section>
  );
}
```

## Behavior

[SEP-10](../../webauth/sep10.md) accepts SDK keypairs and Core envelope signers,
including asynchronous wallet approval. Use the current guarded signer from
`useWallet().signers` or [`useSigners()`](use-signers.md). See the complete
[wallet authentication example](../wallet-authentication.md). Logout,
disconnect, account/network changes and session disposal invalidate pending
approval; a late result cannot exchange a challenge or establish a session.
[SEP-45](../../webauth/sep45.md) retains its explicit `authorize` callback.
Mutations do not retry automatically. Do not persist or dehydrate authentication
mutation variables, which contain signing inputs. Observe ongoing validity with
[useSession](use-session.md), since a completed mutation is not proof that its
session is still active.

## See also

- [All hooks](README.md)
- [Exact API reference](https://jsr.io/@colibri/react/doc/webauth/~/useWebAuth)
