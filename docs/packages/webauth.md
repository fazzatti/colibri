# WebAuth

`@colibri/webauth` provides one client for SEP-10 classic-account and SEP-45
contract-account authentication. It returns a JWT, not an asset token. Routing
is explicit and never falls back to another protocol.

```sh
deno add jsr:@colibri/webauth jsr:@colibri/core npm:@stellar/stellar-sdk
```

Colibri implements SEP-45 v0.1.1 with legacy address credentials.
Server-provided address-v2 or delegated challenge credentials are not accepted.
This is a WebAuth compatibility boundary, separate from Core's transaction
signer support.

## Guides

- [Discovery and routing](webauth/discovery.md)
- [Authenticate a classic account](webauth/sep10.md)
- [Authenticate a contract account](webauth/sep45.md)
- [JWTs and errors](webauth/jwt.md)

See the [API and error reference](../reference/README.md) for exact exported
symbols and complete error contexts.

SEP-10's `Sep10Signer` supports asynchronous Core envelope signers through both
`authenticate()` and `sep10.signChallenge()`. See
[wallet signing](webauth/sep10.md#wallet-and-asynchronous-signers) for
verification, cancellation and multisig semantics. SEP-45 authorization handlers
remain a separate capability.
