# SEP-53 message signing

`LocalSigner.signMessage` signs UTF-8 text or `Uint8Array` using the native
Stellar SDK's SEP-53 format. It does not sign the raw bytes in the same way as
`sign`. Use native `Keypair.verifyMessage` to verify the result.

## Sign and verify locally

No RPC connection or funded account is required. Install `@colibri/core` and a
compatible Stellar SDK as described in
[installation](../../getting-started/installation.md).

<!-- deno-check -->

```ts
import { LocalSigner } from "@colibri/core";
import { Keypair } from "npm:@stellar/stellar-sdk";

using signer = LocalSigner.generateRandom();
const message = "Approve document revision 42.";
const signature = signer.signMessage(message);

const verifier = Keypair.fromPublicKey(signer.publicKey());
console.log(verifier.verifyMessage(message, signature)); // true
console.log(signature.length); // 64 bytes
```

Keep the message and public key alongside the signature. A verifier needs all
three. The `using` declaration destroys the local secret handle at scope exit.

## Optional signer capability

`MessageSigner` accepts synchronous and asynchronous implementations. It is
independent of `Signer`: a message-only signer is not automatically eligible for
transaction envelope signing or Soroban authorization entries. Existing signer
implementations do not need to add this method unless they support SEP-53.

<!-- deno-check -->

```ts
import { isMessageSigner } from "@colibri/core";

async function requestSignature(candidate: unknown, message: string) {
  if (!isMessageSigner(candidate)) return undefined;

  return {
    publicKey: candidate.publicKey(),
    signature: await candidate.signMessage(message),
  };
}
```

The guard checks the capability shape, not the honesty of an external signing
implementation. Verify externally returned signatures before relying on them.

## Intent and failures

A signature proves control of one Ed25519 key. It does not establish that the
key meets an account's multisig threshold. SEP-53 domain separation also does
not define your application's expiry, nonce, audience, or replay policy. Include
and validate that context according to the application's protocol.

`LocalSigner` reports `SIG_LOC_004` when message signing follows destruction and
`SIG_LOC_005` when the native SDK rejects message signing. The latter preserves
the underlying cause without copying the input message into error metadata.

See the [local signer errors](../../reference/errors/core-signer-local.md),
[Core API](https://jsr.io/@colibri/core/doc), and
[SEP-53](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md).
