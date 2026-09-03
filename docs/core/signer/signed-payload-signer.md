# Ed25519SignedPayloadSigner

`Ed25519SignedPayloadSigner` represents Stellar's
[CAP-40](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0040.md)
`P...` signer key. The key contains an Ed25519 public key and a payload of 1 to
64 bytes. Authorization adds an Ed25519 signature over that payload, not over
the transaction hash.

## Explicit Payload

```ts
import { Ed25519SignedPayloadSigner, LocalSigner } from "@colibri/core";

const keypairSigner = LocalSigner.fromSecret("S...");
const signer = Ed25519SignedPayloadSigner.fromPayload({
  signer: keypairSigner,
  payload,
});

signer.signerKey(); // P...
```

This is the low-level protocol path. A signature over an arbitrary payload can
be reused anywhere the same `P...` key is accepted. Choose payloads and signer
lifecycle accordingly.

## Transaction-Bound Payload

For a persistent account signer, the safer convenience is to use one finalized
future transaction hash:

```ts
const signer = Ed25519SignedPayloadSigner.forTransaction({
  signer: keypairSigner,
  transaction: finalizedTransaction,
});

signer.addTarget(accountId);
```

The future transaction must remain byte-for-byte equivalent in every
hash-affecting field, including sequence, fee, operations, memo, preconditions,
and network passphrase.

Do not use `forTransaction(...)` to create an `extraSigners` key for the same
transaction. The transaction hash would depend on the `P...` precondition that
it is being used to construct. For `extraSigners`, use a payload chosen before
the transaction is built.

## Exact Extra Signer

```ts
const config = {
  source: accountId,
  fee: "100",
  timeout: 30,
  signers: [accountSigner, payloadSigner],
  extraSigners: [payloadSigner.signerKey()],
};
```

Colibri matches the `P...` key exactly and adds the payload signature with the
protocol-defined signed-payload hint.
