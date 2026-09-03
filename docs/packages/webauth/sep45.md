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

`ContractAuth.fromSigner(...)` accepts Core's `AuthEntrySigner` capability and
adapts its complete returned entry to the SEP-45 handler boundary. Colibri does
not otherwise constrain its contract-specific contents; enforcing simulation and
the server remain authoritative.

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
