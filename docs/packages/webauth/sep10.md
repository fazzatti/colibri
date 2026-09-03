# Authenticate a classic account

[WebAuth overview](../webauth.md)

Use a home domain advertising SEP-10 and an account/signing key accepted by that
service. This complete script reads them from the environment. Install WebAuth,
Core, and the Stellar SDK as shown in the overview, then run
`deno run --allow-net --allow-env=HOME_DOMAIN,STELLAR_SECRET authenticate.ts`.
Use a disposable Testnet credential for learning; never commit it to source.

<!-- deno-check -->

```ts
import { NetworkConfig } from "@colibri/core";
import { WebAuthClient } from "@colibri/webauth";
import { Keypair } from "npm:@stellar/stellar-sdk";

const domain = Deno.env.get("HOME_DOMAIN");
const secret = Deno.env.get("STELLAR_SECRET");
if (!domain || !secret) throw new Error("Set HOME_DOMAIN and STELLAR_SECRET");
const client = await WebAuthClient.fromDomain(domain, {
  network: NetworkConfig.TestNet(),
});
const keypair = Keypair.fromSecret(secret);
const jwt = await client.sep10.authenticate({
  account: keypair.publicKey(),
  signer: keypair,
});
console.log("Authenticated with", jwt.protocol); // Do not log the bearer JWT.
```

The remaining snippets use the `client` and `keypair` created above.

## Automatic authentication

```typescript
import { Keypair } from "npm:@stellar/stellar-sdk";

const keypair = Keypair.fromSecret("S...");
const jwt = await client.authenticate({
  account: keypair.publicKey(),
  signer: keypair,
});

console.log(jwt.protocol);
// jwt.token is the bearer JWT string; keep it out of logs.
```

## Explicit SEP-10

```typescript
const jwt = await client.sep10.authenticate({
  account: keypair.publicKey(),
  signer: keypair,
  memo: "12345",
});
```

For step-by-step control:

```typescript
const challenge = await client.sep10.getChallenge({
  account: keypair.publicKey(),
});
const signed = await client.sep10.signChallenge(challenge, keypair);
const jwt = await client.sep10.submitChallenge(signed);
```

The first method returns only after Colibri verifies the server signature,
finite inclusive time bounds, sequence, operations, account and memo, home
domain, web-auth domain, and accepted client domain.

The challenge is checked against the **requested** account and memo, not merely
accepted because it is a valid challenge for somebody. A muxed `M...` account
already encodes its ID and cannot also receive a separate `memo` option. The
explicit methods use typed challenge states; do not construct a lookalike object
or reuse a state from another client to bypass verification.

For lower-level composition, the package exports `Sep10Client`, challenge types,
and `verifySep10Challenge`. These are client-side tools; this package is not a
JWT-issuing authentication server. See [JWTs](jwt.md) for what is validated at
the end of the exchange.
