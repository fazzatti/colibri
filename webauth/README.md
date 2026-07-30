# @colibri/webauth

Unified SEP-10 and SEP-45 Web Authentication for Stellar.

`WebAuthClient` discovers the protocols advertised by a domain, routes classic
accounts to SEP-10 and contract accounts to SEP-45, and also exposes each
protocol client for explicit flows.

> SEP-45 is currently a draft. This release implements SEP-45 v0.1.1 with legacy
> address credentials. A server-provided challenge using Protocol 27 address-v2
> or delegated credentials is rejected until the SEP defines their use.

## Installation

```sh
deno add jsr:@colibri/webauth
```

## Automatic authentication

```ts
import { NetworkConfig } from "@colibri/core";
import { WebAuthClient } from "@colibri/webauth";
import { Keypair } from "npm:@stellar/stellar-sdk";

const client = await WebAuthClient.fromDomain("anchor.example.com", {
  network: NetworkConfig.TestNet(),
});

const keypair = Keypair.fromSecret("S...");
const jwt = await client.authenticate({
  account: keypair.publicKey(),
  signer: keypair,
});

console.log(jwt.protocol); // "sep10"
console.log(jwt.token);
```

Routing is deterministic and never falls back:

| Account | Protocol | Required option | Rejected options                                    |
| ------- | -------- | --------------- | --------------------------------------------------- |
| `G...`  | SEP-10   | `signer`        | `authorize`, `authorizationValidityLedgers`         |
| `M...`  | SEP-10   | `signer`        | `memo`, `authorize`, `authorizationValidityLedgers` |
| `C...`  | SEP-45   | `authorize`     | `signer`, `memo`                                    |

Use `client.supports("sep10")`, `client.supports("sep45")`, or
`client.protocolFor(account)` when you need capability or routing information
before authenticating. If the selected protocol was not advertised, the client
fails without trying the other protocol.

## Explicit SEP-10

```ts
const jwt = await client.sep10.authenticate({
  account: keypair.publicKey(),
  signer: keypair,
  memo: "12345",
});
```

The immutable step-by-step flow is also available:

```ts
const challenge = await client.sep10.getChallenge({
  account: keypair.publicKey(),
});
const signed = await client.sep10.signChallenge(challenge, keypair);
const jwt = await client.sep10.submitChallenge(signed);
```

Colibri verifies the complete challenge before returning it, including the
server signature, finite inclusive time bounds, sequence, operation shape,
account and memo binding, home domain, web-auth domain, and any accepted client
domain.

## Explicit SEP-45

A contract account defines its own authorization scheme, so Colibri delegates
the client entry to a full-entry `ContractAuthHandler`:

```ts
import type { ContractAuthHandler, WebAuthClient } from "@colibri/webauth";
import { xdr } from "npm:@stellar/stellar-sdk";

const authorize: ContractAuthHandler = async (entry, context) => {
  // Apply the contract-specific authorization. The handler receives the
  // complete entry after Colibri sets its expiration.
  return xdr.SorobanAuthorizationEntry.fromXDR(
    await authorizeForMyContract(entry.toXDR(), context),
  );
};

const jwt = await client.sep45.authenticate({
  account: "C...",
  authorize,
});
```

The handler may return any structurally valid authorization entry. Colibri does
not guess which fields a custom account needs; it requires the result to pass
enforcing RPC simulation before submission.

By default, client-controlled entries are valid for six ledgers—approximately 30
seconds at a typical five-second ledger cadence. The server entry is always the
hard upper bound. Override the relative window when a signer needs more time:

```ts
const jwt = await client.sep45.authenticate({
  account: "C...",
  authorize,
  authorizationValidityLedgers: 12,
});
```

Built-in adapters cover conventional cases:

```ts
import { ContractAuth } from "@colibri/webauth";

ContractAuth.ed25519(keypair);
ContractAuth.fromSigner(authEntrySigner);
ContractAuth.none(); // A contract whose authorization needs no signature.
```

`ContractAuth.fromSigner(...)` accepts Core's `AuthEntrySigner` capability and
adapts its complete returned entry to the SEP-45 handler boundary. Colibri does
not otherwise constrain its contract-specific contents; enforcing simulation and
the server remain authoritative.

The immutable explicit lifecycle is:

```ts
const challenge = await client.sep45.getChallenge({ account: "C..." });
const authorized = await client.sep45.authorizeChallenge(
  challenge,
  authorize,
);
const prepared = await client.sep45.prepareChallenge(authorized);
const jwt = await client.sep45.submitChallenge(prepared);
```

`prepareChallenge()` performs enforcing simulation and validates that the
challenge can write only the expected WebAuth nonce state. An RPC URL is
therefore required in the supplied `NetworkConfig`.

## Client domains

Pass a client domain and its signer when needed:

```ts
const jwt = await client.authenticate({
  account: keypair.publicKey(),
  signer: keypair,
  clientDomain: "wallet.example.com",
  clientDomainSigner: walletDomainKeypair,
});
```

Colibri fetches the client domain's stellar.toml only when the returned
challenge actually accepts that client domain.

## Tokens and errors

Both protocols return `WebAuthToken`. A token returned by an authenticated flow
is checked for required claims, expiration, subject, and client-domain context.
This package does not verify the JWT signature because SEP WebAuth discovery
does not publish a common JWT verification key.

```ts
import { Sep10Error, Sep45Error, WebAuthError } from "@colibri/webauth";

try {
  await client.authenticate(options);
} catch (error) {
  if (error instanceof Sep45Error) {
    console.error(error.code, error.message);
  } else if (error instanceof Sep10Error || error instanceof WebAuthError) {
    console.error(error.code, error.message);
  }
}
```

`WebAuthToken.decode(rawToken)` only decodes claims and deliberately makes no
authentication or signature-verification claim.

## Local development

SEP-1 requires HTTPS. Set `allowHttp: true` only for local development:

```ts
const client = await WebAuthClient.fromDomain("localhost:8000", {
  network: NetworkConfig.CustomNet({
    networkPassphrase,
    rpcUrl,
    allowHttp: true,
  }),
  allowHttp: true,
});
```

## Security checklist

- Treat the configured `NetworkConfig` as authoritative.
- Keep HTTP disabled outside local development.
- Do not authorize an entry until Colibri has returned a verified challenge.
- Implement custom handlers as narrowly as the account contract permits.
- Submit only `Sep45PreparedChallenge` values that passed enforcing simulation.
- Treat the returned JWT as a bearer credential and store it accordingly.
