import {
  isEnvelopeSigner,
  isKeypairSigner,
  normalizeBinaryData,
} from "@colibri/core";
import { Keypair, StrKey, TransactionBuilder, xdr } from "stellar-sdk";
import { Sep10SigningFailedError } from "@/error.ts";
import type { Sep10Signer } from "@/types.ts";
import type { Transaction } from "@/stellar-sdk-types.ts";

/** Resolve an Ed25519 identity before exposing the challenge to a signer. */
export function sep10SignerKey(signer: Sep10Signer): string {
  const key = isEnvelopeSigner(signer)
    ? signer.signerKey()
    : signer.publicKey();
  if (!StrKey.isValidEd25519PublicKey(key)) {
    throw new Sep10SigningFailedError({
      message: "SEP-10 requires an Ed25519 account signer (G address)",
    });
  }
  return key;
}

/** Sign a defensive clone and accept only an unchanged, additively signed envelope. */
export async function signSep10Transaction(
  transaction: Transaction,
  signer: Sep10Signer,
): Promise<Transaction> {
  const key = Keypair.fromPublicKey(sep10SignerKey(signer));
  const network = transaction.networkPassphrase;
  // Capture immutable bytes before calling application/wallet code: that code
  // can mutate the transaction, its XDR, and the existing signatures in place.
  const body = transaction.toEnvelope().toXdr("base64");
  const hash = normalizeBinaryData(transaction.hash());
  const signatures = transaction.signatures.map((signature) =>
    signature.toXdr("base64")
  );
  const unsigned = TransactionBuilder.fromXdr(body, network) as Transaction;
  let signed: Transaction;
  if (isKeypairSigner(signer)) {
    unsigned.signatures.push(
      new xdr.DecoratedSignature({
        hint: key.signatureHint(),
        signature: normalizeBinaryData(signer.sign(Uint8Array.from(hash))),
      }),
    );
    signed = unsigned;
  } else if (isEnvelopeSigner(signer)) {
    const result = await signer.signTransaction(unsigned);
    signed = TransactionBuilder.fromXdr(result, network) as Transaction;
  } else {
    unsigned.sign(signer);
    signed = unsigned;
  }
  if (
    transaction.toEnvelope().type !== signed.toEnvelope().type ||
    xdr.encodeBytes(transaction.signatureBase(), "base64") !==
      xdr.encodeBytes(signed.signatureBase(), "base64")
  ) {
    throw new Sep10SigningFailedError({
      message: "Signer changed the SEP-10 challenge transaction",
    });
  }
  const added = [...signed.signatures];
  for (const signature of signatures) {
    const index = added.findIndex((candidate) =>
      candidate.toXdr("base64") === signature
    );
    if (index < 0) {
      throw new Sep10SigningFailedError({
        message: "Signer removed or changed an existing SEP-10 signature",
      });
    }
    added.splice(index, 1);
  }
  const hint = key.signatureHint();
  if (
    !added.length ||
    !added.every((signature) =>
      signature.hint.toBytes().every((byte, index) => byte === hint[index]) &&
      key.verify(hash, signature.signature.toBytes())
    )
  ) {
    throw new Sep10SigningFailedError({
      message:
        "Signer did not add a valid SEP-10 signature for its declared key",
    });
  }
  return signed;
}
