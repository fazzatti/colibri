# HashXSigner

`HashXSigner` authorizes a Stellar transaction by revealing a preimage whose
SHA-256 digest is registered as an `X...` signer key.

```ts
import { HashXSigner } from "@colibri/core";

const signer = HashXSigner.generateRandom(true);

const hash = signer.hash();
const signerKey = signer.signerKey(); // X...
```

Use `hash()` when an operation needs the raw 32-byte digest. Use `signerKey()`
when the API accepts a Stellar signer StrKey.

## Account Signer

Register the signer's raw digest on the account in an earlier `setOptions`
transaction. `StrKey.decodeSha256Hash(...)` converts the `X...` identity into
the exact SDK input:

```ts
import { Operation } from "npm:@stellar/stellar-sdk";
import { StrKey } from "@colibri/core";

const installSigner = Operation.setOptions({
  signer: {
    sha256Hash: StrKey.decodeSha256Hash(signer.signerKey()),
    weight: 1,
  },
});

signer.addTarget(accountId);

// `submitWithHashX` is a configured callable transaction pipeline.
await submitWithHashX({
  operations,
  config: {
    source: accountId,
    fee: "100",
    timeout: 30,
    signers: [signer],
  },
});
```

Submit `installSigner` with an account signer before running the transaction
that reveals the preimage.

Hash-X reveals the preimage in the submitted envelope. If the `X...` key is a
persistent account signer, remove or rotate it after disclosure.

## Exact Extra Signer

A Hash-X key can also be a transaction precondition:

```ts
const config = {
  source: accountId,
  fee: "100",
  timeout: 30,
  signers: [accountSigner, hashXSigner],
  extraSigners: [hashXSigner.signerKey()],
};
```

An exact extra signer does not need `addTarget(...)`; Colibri matches it by
`signerKey()`.

## Preimage Lifecycle

- `fromPreimage(bytes)` accepts at most 64 bytes.
- `generateRandom()` creates a secure random 32-byte preimage.
- Passing `true` hides direct `preimage()` access while preserving signing.
- `destroy()` and `Symbol.dispose` zeroize and invalidate retained bytes on a
  best-effort basis.

Do not reuse a disclosed preimage for new authorization policy.
