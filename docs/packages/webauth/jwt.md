# JWTs and errors

[WebAuth overview](../webauth.md)

## Tokens

Both protocols return `WebAuthToken`. Tokens returned by an authenticated flow
are validated for required claims, expiration, subject, and client-domain
context.

`WebAuthToken.decode(raw)` only decodes the JWT. It does not verify the JWT
signature, because WebAuth discovery does not provide a common JWT verification
key.

Both paths use the same JWT format and `WebAuthToken` wrapper; protocol-specific
authentication context is retained separately. A successful WebAuth exchange
checks required claims and expected subject/client-domain context, but does not
cryptographically verify the JWT issuer's signature. Do not use `decode()` as a
server-side authorization check.

Treat `jwt.token` as a bearer credential. Send it only to the intended service
over HTTPS, avoid logs and public error reports, and apply your application's
storage/expiration policy. Obtaining it does not transfer an asset or authorize
an unrelated Stellar transaction.

## Errors

```typescript
import { Sep10Error, Sep45Error, WebAuthError } from "@colibri/webauth";

try {
  await client.authenticate(options);
} catch (error) {
  if (
    error instanceof Sep10Error ||
    error instanceof Sep45Error ||
    error instanceof WebAuthError
  ) {
    console.error(error.code, error.message);
  }
}
```

Shared failures use `WebAuthCode`; protocol validation and lifecycle failures
use `Sep10Code` or `Sep45Code`.

The [complete WebAuth code reference](../../reference/errors/webauth.md) covers
all three families. Discovery can also expose Core's SEP-1 failures. An unknown
error branch is still useful for application-provided signing callbacks.
