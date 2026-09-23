# Authenticate a contract account

[WebAuth overview](../webauth.md)

First [discover the service](discovery.md) with a network configuration
including RPC. You need a deployed contract account, a SEP-45 server on that
network, and knowledge of that account's custom authorization. The snippets
below assume `client` is configured and `authorizeForMyContract` is your
wallet/contract adapter.

## Explicit SEP-45

Contract authorization can vary arbitrarily, so the package gives the complete
client authorization entry to the application:

```typescript
import type { ContractAuthHandler } from "@colibri/webauth";
import { xdr } from "npm:@stellar/stellar-sdk";

const authorize: ContractAuthHandler = async (entry, context) => {
  const authorizedXdr = await authorizeForMyContract(
    entry.toXdr(),
    context.validUntilLedgerSeq,
    context.networkPassphrase,
  );
  return xdr.SorobanAuthorizationEntry.fromXdr(authorizedXdr);
};

const jwt = await client.sep45.authenticate({
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
const jwt = await client.sep45.authenticate({
  account: "C...",
  authorize,
  authorizationValidityLedgers: 12,
});
```

Built-in adapters are available for conventional authorization:

```typescript
import { ContractAuth } from "@colibri/webauth";

const ed25519 = ContractAuth.ed25519(keypair);
const colibri = ContractAuth.fromSigner(authEntrySigner);
const signatureless = ContractAuth.none();
```

`ContractAuth.fromSigner(...)` accepts Core's
[`AuthEntrySigner`](../../core/signer/README.md#signer-capabilities) capability
and adapts its complete returned entry to the SEP-45 handler boundary. Colibri
does not otherwise constrain its contract-specific contents; enforcing
simulation and the server remain authoritative.

The explicit lifecycle uses immutable states:

```typescript
const challenge = await client.sep45.getChallenge({ account: "C..." });
const authorized = await client.sep45.authorizeChallenge(
  challenge,
  authorize,
);
const prepared = await client.sep45.prepareChallenge(authorized);
const jwt = await client.sep45.submitChallenge(prepared);
```

## What Colibri verifies and what the application owns

Before your handler runs, Colibri validates the server challenge's supported
credential shape, expected account, invocation, WebAuth contract/function,
arguments, network, and server authorization. Required SEP arguments must be
present; additional invocation arguments must be consistent across entries. The
server challenge currently accepts the legacy address-credential form, not
address-v2 or delegated forms.

The handler receives the complete entry, with expiration already selected, and
returns the complete authorized entry. It can use signatures, multiple
contracts, or signatureless custom policy. Colibri does not invent that policy
or try to rebuild a contract-specific signature value. `ContractAuth.none()` is
suitable only when the actual account intentionally needs no signature material.

Preparation runs enforcing simulation and validates the footprint; it is not an
on-chain transaction submission. A successful simulation is followed by
challenge submission to the server, which remains the authority that issues the
JWT.

Six ledgers is an approximate convenience default, not a guaranteed wall-clock
deadline. The server's expiration is the upper bound even if you request more
ledgers. Slow user interaction or ledger advancement can invalidate the
challenge; request a fresh one rather than submitting an expired entry.

## Standalone verification and simulation

The [`/sep45` entrypoint](https://jsr.io/@colibri/webauth/doc/sep45) also
exposes individual checks for applications that already own challenge transport.
[`verifySep45Challenge`](https://jsr.io/@colibri/webauth/doc/sep45/~/verifySep45Challenge)
performs its verification locally. The caller must provide trusted discovery
values, the requested account/domain and a current ledger sequence; copying
those expectations from an untrusted response defeats their purpose.

This complete adapter function accepts application-supplied verification inputs.
It performs no HTTP/RPC calls and returns selected verified fields or a typed
error:

<!-- deno-check -->

```ts
import {
  verifySep45Challenge,
  type VerifySep45ChallengeInput,
} from "@colibri/webauth/sep45";

export function inspectReceivedChallenge(input: VerifySep45ChallengeInput) {
  const verified = verifySep45Challenge(input);
  return { account: verified.account, extensions: verified.extensionArguments };
}
```

Obtain the expected server key, WebAuth contract and domains through
[trusted discovery](../webauth/discovery.md); the input reference lists every
required field. Decoding entries with
[`decodeSep45AuthorizationEntries`](https://jsr.io/@colibri/webauth/doc/sep45/~/decodeSep45AuthorizationEntries)
alone does not perform those checks.

[`simulateSep45Challenge`](https://jsr.io/@colibri/webauth/doc/sep45/~/simulateSep45Challenge)
accepts an authorized challenge and explicit RPC, network and WebAuth-contract
options, then returns a simulation receipt. It performs enforcing simulation and
includes
[`validateSep45Footprint`](https://jsr.io/@colibri/webauth/doc/sep45/~/validateSep45Footprint).
The standalone footprint helper checks only the supplied read-write allowlist;
it does not verify a challenge, check its expiry or simulate it.

Prefer the [explicit client lifecycle](#explicit-sep-45) when continuing to
authorization and submission. Its immutable challenge states carry client-owned
provenance checks: a pure verification result or simulation receipt is not a
replacement for the state expected by `authorizeChallenge` or `submitChallenge`.
These helpers do not issue a JWT or implement an authentication server.
