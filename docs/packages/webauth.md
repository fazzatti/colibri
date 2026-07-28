# WebAuth

`@colibri/webauth` provides one client for
[SEP-10](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md)
classic-account authentication and draft
[SEP-45](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0045.md)
contract-account authentication.

{% hint style="warning" %} SEP-45 is a draft. Colibri currently implements
v0.1.1 with legacy address credentials. Protocol 27 address-v2 credentials and
delegates are rejected until the SEP defines their use. {% endhint %}

## Installation

```bash
deno add jsr:@colibri/webauth
```

## Create a client

```typescript
import { NetworkConfig } from "@colibri/core";
import { WebAuthClient } from "@colibri/webauth";

const client = await WebAuthClient.fromDomain("anchor.example.com", {
  network: NetworkConfig.TestNet(),
});
```

The network supplied by the application is authoritative. If stellar.toml or a
challenge response includes a different network passphrase, authentication
fails.

## Choose a path

`WebAuthClient` exposes three entry points:

- `client.authenticate(...)` routes by account type.
- `client.sep10` selects SEP-10 explicitly.
- `client.sep45` selects SEP-45 explicitly.

Automatic routing is deterministic and has no protocol fallback:

| Account | Protocol | Required option | Invalid options                         |
| ------- | -------- | --------------- | --------------------------------------- |
| `G...`  | SEP-10   | `signer`        | SEP-45 authorization options            |
| `M...`  | SEP-10   | `signer`        | `memo` and SEP-45 authorization options |
| `C...`  | SEP-45   | `authorize`     | `signer` and `memo`                     |

Inspect discovery and routing with:

```typescript
client.supports("sep10");
client.supports("sep45");
client.protocolFor(account);
```

## Automatic authentication

```typescript
import { Keypair } from "npm:@stellar/stellar-sdk";

const keypair = Keypair.fromSecret("S...");
const token = await client.authenticate({
  account: keypair.publicKey(),
  signer: keypair,
});

console.log(token.protocol);
console.log(token.token);
```

## Explicit SEP-10

```typescript
const token = await client.sep10.authenticate({
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
const token = await client.sep10.submitChallenge(signed);
```

The first method returns only after Colibri verifies the server signature,
finite inclusive time bounds, sequence, operations, account and memo, home
domain, web-auth domain, and accepted client domain.

## Explicit SEP-45

Contract authorization can vary arbitrarily, so the package gives the complete
client authorization entry to the application:

```typescript
import type { ContractAuthHandler } from "@colibri/webauth";
import { xdr } from "npm:@stellar/stellar-sdk";

const authorize: ContractAuthHandler = async (entry, context) => {
  const authorizedXdr = await authorizeForMyContract(
    entry.toXDR(),
    context.validUntilLedgerSeq,
    context.networkPassphrase,
  );
  return xdr.SorobanAuthorizationEntry.fromXDR(authorizedXdr);
};

const token = await client.sep45.authenticate({
  account: "C...",
  authorize,
});
```

Colibri sets the entry expiration before calling the handler. The handler may
return any structurally valid entry needed by the contract. Colibri then
requires enforcing RPC simulation and checks the transaction footprint before
submitting the challenge.

The default validity is six ledgers, approximately 30 seconds at a typical
five-second ledger cadence. Ledger close times vary, and the server entry is
always the hard upper bound:

```typescript
const token = await client.sep45.authenticate({
  account: "C...",
  authorize,
  authorizationValidityLedgers: 12,
});
```

Built-in adapters are available for conventional authorization:

```typescript
import { ContractAuth } from "@colibri/webauth";

const ed25519 = ContractAuth.ed25519(keypair);
const colibri = ContractAuth.fromSigner(signer);
const signatureless = ContractAuth.none();
```

The explicit lifecycle uses immutable states:

```typescript
const challenge = await client.sep45.getChallenge({ account: "C..." });
const authorized = await client.sep45.authorizeChallenge(
  challenge,
  authorize,
);
const prepared = await client.sep45.prepareChallenge(authorized);
const token = await client.sep45.submitChallenge(prepared);
```

## Client domains

Pass the client domain and its signing key:

```typescript
const token = await client.authenticate({
  account: keypair.publicKey(),
  signer: keypair,
  clientDomain: "wallet.example.com",
  clientDomainSigner: walletDomainKeypair,
});
```

The client domain's stellar.toml is fetched only when the server's challenge
actually accepts the requested client domain.

## Tokens

Both protocols return `WebAuthToken`. Tokens returned by an authenticated flow
are validated for required claims, expiration, subject, and client-domain
context.

`WebAuthToken.decode(raw)` only decodes the JWT. It does not verify the JWT
signature, because WebAuth discovery does not provide a common JWT verification
key.

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
