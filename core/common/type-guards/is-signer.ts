import type {
  AuthEntrySigner,
  EnvelopeSigner,
  KeypairSigner,
  MessageSigner,
  PreAuthTransactionSigner,
  Signer,
} from "@/signer/types.ts";
import { isDefined } from "@/common/index.ts";
import { hasFunction } from "@/common/type-guards/has-function.ts";

/** Returns `true` when the value can sign transaction envelopes. */
export const isEnvelopeSigner = (
  signer: unknown,
): signer is EnvelopeSigner => {
  return (
    isDefined(signer) &&
    hasFunction(signer, "signerKey") &&
    hasFunction(signer, "signTransaction") &&
    hasFunction(signer, "signsFor")
  );
};

/**
 * Returns whether the value provides SEP-53 message signing. This capability is
 * independent of the transaction capabilities checked by `isSigner`.
 */
export const isMessageSigner = (signer: unknown): signer is MessageSigner => {
  return isDefined(signer) && hasFunction(signer, "publicKey") &&
    hasFunction(signer, "signMessage");
};

/** Returns `true` when the value can authorize one exact pre-authorized transaction. */
export const isPreAuthTransactionSigner = (
  signer: unknown,
): signer is PreAuthTransactionSigner => {
  return (
    isDefined(signer) &&
    hasFunction(signer, "signerKey") &&
    hasFunction(signer, "authorizesTransaction") &&
    hasFunction(signer, "signsFor")
  );
};

/** Returns `true` when the value can sign Soroban authorization entries. */
export const isAuthEntrySigner = (
  signer: unknown,
): signer is AuthEntrySigner => {
  return (
    isDefined(signer) &&
    hasFunction(signer, "signSorobanAuthEntry") &&
    hasFunction(signer, "signsFor")
  );
};

/** Returns `true` when the value provides a supported signing capability. */
export const isSigner = (signer: unknown): signer is Signer => {
  return (
    isEnvelopeSigner(signer) ||
    isPreAuthTransactionSigner(signer) ||
    isAuthEntrySigner(signer)
  );
};

/** Returns `true` when the value satisfies the complete keypair signer contract. */
export const isKeypairSigner = (signer: unknown): signer is KeypairSigner => {
  return (
    isDefined(signer) &&
    hasFunction(signer, "publicKey") &&
    hasFunction(signer, "sign") &&
    isEnvelopeSigner(signer) &&
    isAuthEntrySigner(signer)
  );
};
